from __future__ import annotations

import io
import time
import sys
from collections.abc import Callable
from pathlib import Path
from threading import Lock
from typing import Any


MODEL_ID = "qwen3-tts-0.6b-base"
MODEL_REPO = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"
MODEL_REVISION = "5d83992436eae1d760afd27aff78a71d676296fc"
MAX_GENERATION_TOKENS = 4_096


def peak_rss_mib() -> float | None:
    if sys.platform == "win32":
        import ctypes

        class ProcessMemoryCounters(ctypes.Structure):
            _fields_ = [
                ("cb", ctypes.c_ulong),
                ("PageFaultCount", ctypes.c_ulong),
                ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t),
                ("PeakPagefileUsage", ctypes.c_size_t),
            ]

        counters = ProcessMemoryCounters()
        counters.cb = ctypes.sizeof(counters)
        success = ctypes.windll.psapi.GetProcessMemoryInfo(
            ctypes.windll.kernel32.GetCurrentProcess(), ctypes.byref(counters), counters.cb
        )
        return round(counters.PeakWorkingSetSize / (1024**2), 1) if success else None

    import resource

    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    peak_bytes = peak if sys.platform == "darwin" else peak * 1024
    return round(peak_bytes / (1024**2), 1)


def token_budget_for_text(text: str) -> int:
    """Bound codec work for short text while allowing longer passages to scale."""
    return min(MAX_GENERATION_TOKENS, max(128, len(text) * 4))


class ModelNotInstalled(RuntimeError):
    pass


class QwenGenerator:
    def __init__(self):
        self._model: Any = None
        self._load_seconds = 0.0
        self._lock = Lock()

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @staticmethod
    def model_path() -> Path:
        from huggingface_hub import snapshot_download
        from huggingface_hub.errors import LocalEntryNotFoundError

        try:
            return Path(snapshot_download(MODEL_REPO, revision=MODEL_REVISION, local_files_only=True))
        except LocalEntryNotFoundError as error:
            raise ModelNotInstalled(MODEL_ID) from error

    @classmethod
    def is_installed(cls) -> bool:
        try:
            cls.model_path()
            return True
        except (ModelNotInstalled, OSError, ValueError):
            return False

    def generate(
        self,
        *,
        audio_path: Path,
        transcript: str,
        text: str,
        on_phase: Callable[[str], None],
    ) -> tuple[bytes, dict[str, float | None]]:
        with self._lock:
            on_phase("loading_model")
            if self._model is None:
                load_started = time.perf_counter()
                import torch
                from qwen_tts import Qwen3TTSModel

                model_path = self.model_path()
                self._model = Qwen3TTSModel.from_pretrained(
                    str(model_path),
                    device_map="cpu",
                    dtype=torch.float32,
                    attn_implementation="sdpa",
                )
                self._load_seconds = time.perf_counter() - load_started

            on_phase("generating")
            generation_started = time.perf_counter()
            waveforms, sample_rate = self._model.generate_voice_clone(
                text=text,
                language="Korean",
                ref_audio=str(audio_path),
                ref_text=transcript,
                max_new_tokens=token_budget_for_text(text),
            )
            generation_seconds = time.perf_counter() - generation_started

        import soundfile as sf

        output = io.BytesIO()
        sf.write(output, waveforms[0], sample_rate, format="WAV", subtype="PCM_16")
        return output.getvalue(), {
            "model_load_seconds": round(self._load_seconds, 2),
            "generation_seconds": round(generation_seconds, 2),
            "peak_rss_mib": peak_rss_mib(),
        }
