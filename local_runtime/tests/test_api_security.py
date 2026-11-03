import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class LocalApiSecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data_dir = tempfile.TemporaryDirectory()
        with socket.socket() as server:
            server.bind(("127.0.0.1", 0))
            cls.port = server.getsockname()[1]
        env = os.environ.copy()
        env.update({
            "LOCAL_VOICE_PORT": str(cls.port),
            "LOCAL_VOICE_ALLOWED_ORIGINS": "https://studio.example.test",
            "LOCAL_VOICE_PAIRING_CODE": "test-pair-code-123",
            "LOCAL_VOICE_DATA_DIR": cls.data_dir.name,
        })
        cls.process = subprocess.Popen(
            [sys.executable, "-m", "local_runtime.app"],
            cwd=ROOT.parent,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        cls.base = f"http://127.0.0.1:{cls.port}/api/v1"
        for _ in range(600):
            try:
                cls.request("GET", "/health")
                break
            except (OSError, urllib.error.URLError):
                if cls.process.poll() is not None:
                    stderr = cls.process.communicate()[1].decode("utf-8", errors="replace")
                    raise RuntimeError(f"local API exited before startup:\n{stderr}")
                time.sleep(0.05)
        else:
            cls.process.terminate()
            stderr = cls.process.communicate(timeout=5)[1].decode("utf-8", errors="replace")
            raise RuntimeError(f"local API did not start within 30 seconds:\n{stderr}")
        status, _, body = cls.request("POST", "/pair", payload={"code": "test-pair-code-123"})
        if status != 200:
            raise RuntimeError("local API pairing bootstrap failed")
        cls.token = json.loads(body)["access_token"]

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        cls.process.wait(timeout=5)
        if cls.process.stderr:
            cls.process.stderr.close()
        cls.data_dir.cleanup()

    @classmethod
    def request(cls, method, path, *, origin="https://studio.example.test", payload=None, body=None, headers=None, host=None):
        data = body if body is not None else (None if payload is None else json.dumps(payload).encode())
        request_headers = {"Origin": origin}
        if data is not None:
            request_headers["Content-Type"] = "application/json"
        request_headers.update(headers or {})
        request = urllib.request.Request(cls.base + path, data=data, headers=request_headers, method=method)
        if host:
            request.add_header("Host", host)
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return response.status, response.headers, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.headers, error.read()

    def test_health_is_public_and_does_not_expose_local_paths(self):
        status, _, body = self.request("GET", "/health")
        self.assertEqual(status, 200)
        payload = json.loads(body)
        self.assertEqual(payload["status"], "ok")
        self.assertNotIn("path", json.dumps(payload).lower())

    def test_unapproved_origin_and_host_are_rejected(self):
        self.assertEqual(self.request("GET", "/health", origin="https://attacker.example")[0], 403)
        self.assertEqual(self.request("GET", "/health", host="attacker.example")[0], 400)
        status, headers, _ = self.request("OPTIONS", "/pair", headers={
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        })
        self.assertEqual(status, 200)
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), "https://studio.example.test")

    def test_pairing_requires_allowed_origin_and_valid_one_time_code(self):
        self.assertEqual(self.request("POST", "/pair", origin="https://attacker.example", payload={"code": "test-pair-code-123"})[0], 403)
        self.assertEqual(self.request("POST", "/pair", payload={"code": "00000000"})[0], 401)
        self.assertEqual(self.request("POST", "/pair", payload={"code": "test-pair-code-123"})[0], 401)

    def test_system_requires_bearer_and_custom_header(self):
        status, _, _ = self.request("GET", "/system")
        self.assertEqual(status, 401)
        auth = {"Authorization": f"Bearer {self.token}"}
        self.assertEqual(self.request("GET", "/system", headers=auth)[0], 403)
        auth["X-Local-Request"] = "1"
        self.assertEqual(self.request("GET", "/system", headers=auth)[0], 200)

    def test_recordings_require_session_and_round_trip_only_under_local_data_dir(self):
        boundary = "voice-studio-boundary"
        audio = _test_wav()
        body = (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"transcript\"\r\n\r\n"
            "안녕하세요. 오늘 녹음을 시작합니다.\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"my-take.wav\"\r\n"
            "Content-Type: audio/wav\r\n\r\n"
        ).encode() + audio + f"\r\n--{boundary}--\r\n".encode()
        headers = {"Authorization": f"Bearer {self.token}", "X-Local-Request": "1", "Content-Type": f"multipart/form-data; boundary={boundary}"}
        status, _, response = self.request("POST", "/recordings", body=body, headers=headers)
        self.assertEqual(status, 201)
        recording = json.loads(response)
        self.assertEqual(recording["sample_rate"], 24_000)
        self.assertEqual(recording["transcript"], "안녕하세요. 오늘 녹음을 시작합니다.")
        status, _, listing = self.request("GET", "/recordings", headers=headers)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(listing)["items"][0]["id"], recording["id"])
        status, _, downloaded = self.request("GET", f"/recordings/{recording['id']}/audio", headers=headers)
        self.assertEqual(status, 200)
        self.assertEqual(downloaded, audio)
        self.assertEqual(self.request("DELETE", f"/recordings/{recording['id']}", headers=headers)[0], 204)

    def test_model_catalog_is_private_and_generation_rejects_unknown_model(self):
        headers = {"Authorization": f"Bearer {self.token}", "X-Local-Request": "1"}
        status, _, body = self.request("GET", "/models", headers=headers)
        self.assertEqual(status, 200)
        catalog = json.loads(body)["items"]
        self.assertEqual(catalog[0]["id"], "qwen3-tts-0.6b-base")
        self.assertIn(catalog[0]["status"], {"installed", "not_installed"})
        self.assertNotIn("/home/", body.decode())
        status, _, _ = self.request("POST", "/generations", headers=headers, payload={
            "recording_id": "00000000-0000-4000-8000-000000000001",
            "text": "짧은 테스트 문장입니다.",
            "model_id": "unknown-model",
        })
        self.assertEqual(status, 400)

    def test_model_install_requires_allowlisted_model_and_explicit_license_acknowledgement(self):
        headers = {"Authorization": f"Bearer {self.token}", "X-Local-Request": "1"}
        self.assertEqual(self.request("POST", "/models/unknown/install", headers=headers, payload={"accept_license": True})[0], 404)
        self.assertEqual(self.request("POST", "/models/qwen3-tts-0.6b-base/install", headers=headers, payload={"accept_license": False})[0], 400)


if __name__ == "__main__":
    unittest.main()


def _test_wav():
    import io
    import wave

    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(24_000)
        wav.writeframes(b"\0\0" * 24_000)
    return output.getvalue()
