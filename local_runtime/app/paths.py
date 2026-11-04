from __future__ import annotations

import os
import platform
from pathlib import Path
from typing import Mapping


def default_data_dir(
    *,
    system: str | None = None,
    environ: Mapping[str, str] | None = None,
    home: Path | None = None,
) -> Path:
    system = system or platform.system()
    environ = os.environ if environ is None else environ
    home = Path.home() if home is None else home
    if system == "Windows":
        local_app_data = environ.get("LOCALAPPDATA")
        root = Path(local_app_data) if local_app_data else home / "AppData" / "Local"
        return root / "VoiceStudio"
    return home / ".local" / "share" / "voice-studio"
