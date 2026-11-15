import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from local_runtime.app.system_info import memory_available_gib


class SystemInfoTests(unittest.TestCase):
    @patch("local_runtime.app.system_info.platform.system", return_value="Linux")
    def test_reads_memavailable_instead_of_only_unreclaimed_free_pages(self, _system):
        with tempfile.TemporaryDirectory() as temp_dir:
            meminfo = Path(temp_dir) / "meminfo"
            meminfo.write_text("MemFree: 400000 kB\nMemAvailable: 7000000 kB\n", encoding="ascii")
            self.assertEqual(memory_available_gib(meminfo), 6.68)

    @patch("local_runtime.app.system_info.platform.system", return_value="Linux")
    def test_returns_none_when_linux_meminfo_is_unavailable(self, _system):
        self.assertIsNone(memory_available_gib(Path("/missing/meminfo")))


if __name__ == "__main__":
    unittest.main()
