from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .storage import LocalRecordingStore


class WorkspaceError(ValueError):
    pass


class WorkspaceStore:
    def __init__(self, data_dir: Path):
        self.root = data_dir / 'workspaces'
        self.root.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()

    def _path(self, workspace_id: str) -> Path:
        try:
            safe_id = str(uuid.UUID(workspace_id))
        except (ValueError, AttributeError) as error:
            raise WorkspaceError('invalid_workspace_id') from error
        return self.root / f'{safe_id}.json'

    def get(self, workspace_id: str) -> dict | None:
        try:
            return json.loads(self._path(workspace_id).read_text(encoding='utf-8'))
        except FileNotFoundError:
            return None

    def list(self) -> list[dict]:
        return sorted((json.loads(path.read_text(encoding='utf-8')) for path in self.root.glob('*.json')), key=lambda item: item['updated_at'], reverse=True)

    def _write(self, work: dict) -> dict:
        LocalRecordingStore._atomic_write(self._path(work['id']), json.dumps(work, ensure_ascii=False).encode('utf-8'))
        return work

    def create(self, title: str) -> dict:
        if not title.strip() or len(title) > 120:
            raise WorkspaceError('invalid_workspace_title')
        now = datetime.now(timezone.utc).isoformat()
        with self.lock:
            return self._write({'id': str(uuid.uuid4()), 'title': title.strip(), 'text': '', 'recording_id': None, 'selected_output_id': None, 'created_at': now, 'updated_at': now})

    def update(self, workspace_id: str, *, title: str, text: str, recording_id: str | None, generation_settings: dict | None = None) -> dict:
        if not title.strip() or len(title) > 120 or len(text) > 1000:
            raise WorkspaceError('invalid_workspace_input')
        with self.lock:
            work = self.get(workspace_id)
            if work is None:
                raise WorkspaceError('workspace_not_found')
            if generation_settings is not None:
                work["generation_settings"] = dict(generation_settings)
            work.update(title=title.strip(), text=text, recording_id=recording_id, updated_at=datetime.now(timezone.utc).isoformat())
            return self._write(work)

    def select_output(self, workspace_id: str, output: dict) -> dict:
        with self.lock:
            work = self.get(workspace_id)
            if work is None:
                raise WorkspaceError('workspace_not_found')
            if output.get('workspace_id') != workspace_id:
                raise WorkspaceError('output_workspace_mismatch')
            work.update(selected_output_id=output['id'], updated_at=datetime.now(timezone.utc).isoformat())
            return self._write(work)

    def clear_output_selection(self, output_id: str) -> None:
        with self.lock:
            for work in self.list():
                if work.get('selected_output_id') == output_id:
                    work.update(selected_output_id=None, updated_at=datetime.now(timezone.utc).isoformat())
                    self._write(work)
