import unittest
from pathlib import Path
from unittest.mock import patch

from local_runtime.app.paths import default_data_dir
from local_runtime.app.system_info import memory_available_gib, memory_total_gib


class WindowsPlatformTests(unittest.TestCase):
    def test_windows_memory_values_are_reported_in_gib(self):
        with patch("local_runtime.app.system_info.platform.system", return_value="Windows"):
            with patch("local_runtime.app.system_info._windows_memory_bytes", return_value=(16 * 1024**3, 6 * 1024**3)):
                self.assertEqual(memory_total_gib(), 16.0)
                self.assertEqual(memory_available_gib(), 6.0)

    def test_windows_data_directory_uses_local_app_data(self):
        result = default_data_dir(
            system="Windows",
            environ={"LOCALAPPDATA": "C:/Users/voice/AppData/Local"},
            home=Path("C:/Users/voice"),
        )

        self.assertEqual(result, Path("C:/Users/voice/AppData/Local/VoiceStudio"))

    def test_linux_data_directory_keeps_existing_location(self):
        result = default_data_dir(system="Linux", environ={}, home=Path("/home/voice"))

        self.assertEqual(result, Path("/home/voice/.local/share/voice-studio"))

    def test_runtime_generation_module_does_not_import_unix_resource_at_module_load(self):
        import local_runtime.app.generation as generation

        self.assertTrue(callable(generation.peak_rss_mib))

    def test_linux_total_memory_uses_physical_page_count(self):
        with patch("local_runtime.app.system_info.platform.system", return_value="Linux"):
            with patch("local_runtime.app.system_info.os.sysconf", side_effect=lambda key: 4096 if key == "SC_PHYS_PAGES" else 4096):
                self.assertEqual(memory_total_gib(), 0.02)


if __name__ == "__main__":
    unittest.main()
