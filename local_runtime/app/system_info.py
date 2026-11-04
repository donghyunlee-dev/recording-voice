from __future__ import annotations

import ctypes
import os
import platform
from pathlib import Path


class _MemoryStatusEx(ctypes.Structure):
    _fields_ = [
        ("dwLength", ctypes.c_ulong),
        ("dwMemoryLoad", ctypes.c_ulong),
        ("ullTotalPhys", ctypes.c_ulonglong),
        ("ullAvailPhys", ctypes.c_ulonglong),
        ("ullTotalPageFile", ctypes.c_ulonglong),
        ("ullAvailPageFile", ctypes.c_ulonglong),
        ("ullTotalVirtual", ctypes.c_ulonglong),
        ("ullAvailVirtual", ctypes.c_ulonglong),
        ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
    ]


def _windows_memory_bytes() -> tuple[int, int] | None:
    status = _MemoryStatusEx()
    status.dwLength = ctypes.sizeof(status)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
        return None
    return status.ullTotalPhys, status.ullAvailPhys


def _windows_memory_gib(value: int) -> float:
    return round(value / (1024**3), 2)


def memory_total_gib() -> float | None:
    if platform.system() == "Windows":
        memory = _windows_memory_bytes()
        return _windows_memory_gib(memory[0]) if memory else None
    try:
        pages = os.sysconf("SC_PHYS_PAGES")
        page_size = os.sysconf("SC_PAGE_SIZE")
        return round(pages * page_size / (1024**3), 2)
    except (ValueError, OSError, TypeError):
        return None


def memory_available_gib(meminfo_path: Path | None = None) -> float | None:
    if platform.system() == "Windows":
        memory = _windows_memory_bytes()
        return _windows_memory_gib(memory[1]) if memory else None
    meminfo_path = meminfo_path or Path("/proc/meminfo")
    try:
        for line in meminfo_path.read_text(encoding="ascii").splitlines():
            if line.startswith("MemAvailable:"):
                available_kib = int(line.split()[1])
                return round(available_kib / (1024**2), 2)
    except (OSError, ValueError, IndexError):
        return None
    return None
