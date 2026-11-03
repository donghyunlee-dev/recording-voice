from __future__ import annotations

import json
import os
import tempfile
import uuid
import wave
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any


MAX_RECORDING_BYTES = 24 * 1024 * 1024
MAX_RECORDING_SECONDS = 300
REQUIRED_SAMPLE_RATE = 24_000
MAX_TRANSCRIPT_LENGTH = 5_000


class RecordingError(ValueError):
    pass


class LocalRecordingStore:
    def __init__(self, data_dir: Path):
        self.root = data_dir / "recordings"
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, audio: bytes, transcript: str) -> dict[str, Any]:
        transcript = transcript.strip()
        if not transcript:
            raise RecordingError("transcript_required")
        if len(transcript) > MAX_TRANSCRIPT_LENGTH:
            raise RecordingError("transcript_too_long")
        if len(audio) > MAX_RECORDING_BYTES:
            raise RecordingError("recording_too_large")
        try:
            with wave.open(BytesIO(audio), "rb") as wav:
                channels = wav.getnchannels()
                sample_rate = wav.getframerate()
                sample_width = wav.getsampwidth()
                frame_count = wav.getnframes()
                duration = frame_count / sample_rate
                if wav.getcomptype() != "NONE" or channels != 1 or sample_width != 2:
                    raise RecordingError("wav_must_be_pcm16_mono")
                if sample_rate != REQUIRED_SAMPLE_RATE:
                    raise RecordingError("unsupported_sample_rate")
                if duration <= 0 or duration > MAX_RECORDING_SECONDS:
                    raise RecordingError("invalid_recording_duration")
        except (wave.Error, EOFError, ZeroDivisionError) as error:
            raise RecordingError("invalid_wav") from error

        recording_id = str(uuid.uuid4())
        metadata = {
            "id": recording_id,
            "transcript": transcript,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": round(duration, 3),
            "sample_rate": sample_rate,
            "channels": channels,
            "bytes": len(audio),
        }
        audio_path = self.audio_path(recording_id)
        manifest_path = self.manifest_path(recording_id)
        try:
            self._atomic_write(audio_path, audio)
            self._atomic_write(manifest_path, json.dumps(metadata, ensure_ascii=False).encode("utf-8"))
        except OSError:
            audio_path.unlink(missing_ok=True)
            manifest_path.unlink(missing_ok=True)
            raise
        return metadata

    def list(self) -> list[dict[str, Any]]:
        recordings = []
        for path in self.root.glob("*.json"):
            try:
                recordings.append(json.loads(path.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError):
                continue
        return sorted(recordings, key=lambda item: item.get("created_at", ""), reverse=True)

    def get(self, recording_id: str) -> dict[str, Any] | None:
        path = self.manifest_path(recording_id)
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return None

    def audio_path(self, recording_id: str) -> Path:
        safe_id = self._validate_id(recording_id)
        return self.root / f"{safe_id}.wav"

    def manifest_path(self, recording_id: str) -> Path:
        safe_id = self._validate_id(recording_id)
        return self.root / f"{safe_id}.json"

    def delete(self, recording_id: str) -> bool:
        manifest = self.manifest_path(recording_id)
        audio = self.audio_path(recording_id)
        if not manifest.exists():
            return False
        audio.unlink(missing_ok=True)
        manifest.unlink(missing_ok=True)
        return True

    @staticmethod
    def _validate_id(recording_id: str) -> str:
        try:
            parsed = uuid.UUID(recording_id)
        except (ValueError, AttributeError) as error:
            raise RecordingError("invalid_recording_id") from error
        if str(parsed) != recording_id.lower():
            raise RecordingError("invalid_recording_id")
        return str(parsed)

    @staticmethod
    def _atomic_write(path: Path, content: bytes) -> None:
        temporary_path = None
        try:
            with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
                temporary_path = Path(temporary.name)
                temporary.write(content)
                temporary.flush()
                os.fsync(temporary.fileno())
            os.replace(temporary_path, path)
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)


class LocalOutputStore:
    def __init__(self, data_dir: Path):
        self.root = data_dir / "outputs"
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, audio: bytes, metadata: dict[str, Any]) -> dict[str, Any]:
        try:
            with wave.open(BytesIO(audio), "rb") as wav:
                if wav.getcomptype() != "NONE" or wav.getnchannels() != 1 or wav.getsampwidth() != 2:
                    raise RecordingError("invalid_generated_wav")
                sample_rate = wav.getframerate()
                duration = wav.getnframes() / sample_rate
                if duration <= 0:
                    raise RecordingError("empty_generated_wav")
        except (wave.Error, EOFError, ZeroDivisionError) as error:
            raise RecordingError("invalid_generated_wav") from error
        output_id = str(uuid.uuid4())
        result = {
            **metadata,
            "id": output_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": round(duration, 3),
            "sample_rate": sample_rate,
            "bytes": len(audio),
        }
        audio_path = self.audio_path(output_id)
        manifest_path = self.manifest_path(output_id)
        try:
            LocalRecordingStore._atomic_write(audio_path, audio)
            LocalRecordingStore._atomic_write(manifest_path, json.dumps(result, ensure_ascii=False).encode("utf-8"))
        except OSError:
            audio_path.unlink(missing_ok=True)
            manifest_path.unlink(missing_ok=True)
            raise
        return result

    def list(self) -> list[dict[str, Any]]:
        items = []
        for path in self.root.glob("*.json"):
            try:
                items.append(json.loads(path.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError):
                continue
        return sorted(items, key=lambda item: item.get("created_at", ""), reverse=True)

    def get(self, output_id: str) -> dict[str, Any] | None:
        try:
            path = self.manifest_path(output_id)
        except RecordingError:
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return None

    def audio_path(self, output_id: str) -> Path:
        return self._path(output_id, ".wav")

    def manifest_path(self, output_id: str) -> Path:
        return self._path(output_id, ".json")

    def delete(self, output_id: str) -> bool:
        manifest = self.manifest_path(output_id)
        if not manifest.exists():
            return False
        self.audio_path(output_id).unlink(missing_ok=True)
        manifest.unlink(missing_ok=True)
        return True

    def _path(self, output_id: str, suffix: str) -> Path:
        try:
            safe_id = str(uuid.UUID(output_id))
        except (ValueError, AttributeError) as error:
            raise RecordingError("invalid_output_id") from error
        if safe_id != output_id.lower():
            raise RecordingError("invalid_output_id")
        return self.root / f"{safe_id}{suffix}"
