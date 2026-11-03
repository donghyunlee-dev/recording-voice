from pathlib import Path


def memory_available_gib(meminfo_path: Path = Path("/proc/meminfo")) -> float | None:
    try:
        for line in meminfo_path.read_text(encoding="ascii").splitlines():
            if line.startswith("MemAvailable:"):
                available_kib = int(line.split()[1])
                return round(available_kib / (1024**2), 2)
    except (OSError, ValueError, IndexError):
        return None
    return None
