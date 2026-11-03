from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .storage import LocalRecordingStore


TRANSITIONS = {
    "queued": {"loading_model", "downloading", "generating", "failed", "cancelled"},
    "loading_model": {"generating", "failed"},
    "generating": {"completed", "failed"},
    "downloading": {"downloading", "completed", "failed", "cancelled"},
    "completed": set(),
    "failed": set(),
    "cancelled": set(),
}


class JobStore:
    def __init__(self, data_dir: Path):
        self.root = data_dir / "jobs"
        self.root.mkdir(parents=True, exist_ok=True)

    def create(self, kind: str, **metadata: Any) -> dict[str, Any]:
        job_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        job = {"id": job_id, "kind": kind, "status": "queued", "created_at": now, "updated_at": now, **metadata}
        self._write(job_id, job)
        return job

    def get(self, job_id: str) -> dict[str, Any] | None:
        try:
            safe_id = str(uuid.UUID(job_id))
        except (ValueError, AttributeError):
            return None
        try:
            return json.loads(self._path(safe_id).read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            return None

    def active_count(self) -> int:
        return sum(1 for job in self.root.glob("*.json") if self._is_active(job))

    def list(self) -> list[dict[str, Any]]:
        items = []
        for path in self.root.glob("*.json"):
            try:
                items.append(json.loads(path.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError):
                continue
        return items

    def recover_interrupted(self) -> None:
        for job in self.list():
            if job.get("status") not in {"queued", "loading_model", "generating", "downloading"}:
                continue
            job["status"] = "failed"
            job["error_code"] = "runtime_restarted"
            job["updated_at"] = datetime.now(timezone.utc).isoformat()
            self._write(job["id"], job)

    @staticmethod
    def _is_active(path: Path) -> bool:
        try:
            return json.loads(path.read_text(encoding="utf-8")).get("status") in {"queued", "loading_model", "generating", "downloading"}
        except (OSError, json.JSONDecodeError):
            return False

    def update(self, job_id: str, *, status: str, **metadata: Any) -> dict[str, Any]:
        try:
            safe_id = str(uuid.UUID(job_id))
        except (ValueError, AttributeError) as error:
            raise ValueError("invalid_job_id") from error
        job = self.get(safe_id)
        if job is None:
            raise ValueError("job_not_found")
        if status != job["status"] and status not in TRANSITIONS.get(job["status"], set()):
            raise ValueError("invalid_job_transition")
        job.update(metadata)
        job["status"] = status
        job["updated_at"] = datetime.now(timezone.utc).isoformat()
        self._write(safe_id, job)
        return job

    def _write(self, job_id: str, job: dict[str, Any]) -> None:
        payload = json.dumps(job, ensure_ascii=False).encode("utf-8")
        LocalRecordingStore._atomic_write(self._path(job_id), payload)

    def _path(self, job_id: str) -> Path:
        return self.root / f"{job_id}.json"
