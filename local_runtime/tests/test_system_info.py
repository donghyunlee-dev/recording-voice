import tempfile
import unittest
from pathlib import Path

from local_runtime.app.system_info import memory_available_gib


class SystemInfoTests(unittest.TestCase):
    def test_reads_memavailable_instead_of_only_unreclaimed_free_pages(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            meminfo = Path(temp_dir) / "meminfo"
            meminfo.write_text("MemFree: 400000 kB\nMemAvailable: 7000000 kB\n", encoding="ascii")
            self.assertEqual(memory_available_gib(meminfo), 6.68)

    def test_returns_none_when_linux_meminfo_is_unavailable(self):
        self.assertIsNone(memory_available_gib(Path("/missing/meminfo")))


if __name__ == "__main__":
    unittest.main()
