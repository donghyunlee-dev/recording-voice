import io
import tempfile
import unittest
import wave
from pathlib import Path

from local_runtime.app.storage import LocalOutputStore, LocalRecordingStore, RecordingError


def wav_bytes(*, sample_rate=24_000, channels=1, sample_width=2, seconds=1):
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(sample_width)
        wav.setframerate(sample_rate)
        wav.writeframes(b"\x00" * sample_rate * channels * sample_width * seconds)
    return output.getvalue()


class LocalRecordingStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.store = LocalRecordingStore(Path(self.temp_dir.name))

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_saves_valid_wav_and_manifest_atomically_for_safe_id(self):
        recording = self.store.save(wav_bytes(), "안녕하세요. 오늘 녹음을 시작합니다.")
        loaded = self.store.get(recording["id"])
        self.assertEqual(loaded["transcript"], "안녕하세요. 오늘 녹음을 시작합니다.")
        self.assertEqual(loaded["sample_rate"], 24_000)
        self.assertEqual(self.store.audio_path(recording["id"]).read_bytes()[:4], b"RIFF")
        self.assertEqual(len(self.store.list()), 1)

    def test_rejects_invalid_audio_shape_and_path_ids(self):
        for payload in (b"not wave", wav_bytes(sample_rate=16_000), wav_bytes(channels=2)):
            with self.subTest(payload_length=len(payload)):
                with self.assertRaises(RecordingError):
                    self.store.save(payload, "짧은 대본")
        with self.assertRaises(RecordingError):
            self.store.audio_path("../../etc/passwd")

    def test_rejects_empty_or_overlong_transcript(self):
        with self.assertRaises(RecordingError):
            self.store.save(wav_bytes(), "  ")
        with self.assertRaises(RecordingError):
            self.store.save(wav_bytes(), "가" * 5_001)

    def test_generated_outputs_are_persisted_and_deleted_by_safe_id(self):
        outputs = LocalOutputStore(Path(self.temp_dir.name))
        result = outputs.save(wav_bytes(seconds=2), {"model_id": "qwen3-tts-0.6b-base", "text": "짧은 생성 문장"})
        self.assertEqual(outputs.get(result["id"])["model_id"], "qwen3-tts-0.6b-base")
        self.assertEqual(result["duration_seconds"], 2.0)
        self.assertTrue(outputs.delete(result["id"]))
        self.assertIsNone(outputs.get(result["id"]))


if __name__ == "__main__":
    unittest.main()
