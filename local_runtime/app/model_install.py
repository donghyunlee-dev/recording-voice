from __future__ import annotations

import threading
from collections.abc import Callable

from .generation import MODEL_REPO, MODEL_REVISION


class ModelInstallCancelled(RuntimeError):
    pass


class ModelInstaller:
    def download(
        self,
        *,
        cancel_event: threading.Event,
        on_progress: Callable[[int, int | None], None],
    ) -> str:
        from huggingface_hub import snapshot_download
        from tqdm.auto import tqdm

        bars: dict[int, tuple[int, int | None]] = {}
        last_reported = 0.0
        lock = threading.Lock()

        def update_bar(bar_id: int, current: int, total: int | None) -> None:
            nonlocal last_reported
            if cancel_event.is_set():
                raise ModelInstallCancelled("download_cancelled")
            with lock:
                bars[bar_id] = (current, total)
                now = time.monotonic()
                if now - last_reported < 0.5 and total is not None and current < total:
                    return
                last_reported = now
                downloaded = sum(item[0] for item in bars.values())
                known_totals = [item[1] for item in bars.values() if item[1] is not None]
                on_progress(downloaded, sum(known_totals) if known_totals else None)

        class ProgressBar(tqdm):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                update_bar(id(self), self.n, self.total)

            def update(self, n=1):
                result = super().update(n)
                update_bar(id(self), self.n, self.total)
                return result

        if cancel_event.is_set():
            raise ModelInstallCancelled("download_cancelled")
        path = snapshot_download(
            repo_id=MODEL_REPO,
            revision=MODEL_REVISION,
            local_files_only=False,
            resume_download=True,
            max_workers=4,
            tqdm_class=ProgressBar,
        )
        if cancel_event.is_set():
            raise ModelInstallCancelled("download_cancelled")
        return path
