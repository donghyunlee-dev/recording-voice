import hashlib
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch
from local_runtime.app import expression_install


class ExpressionInstallTests(unittest.TestCase):
    def test_installs_only_verified_assets_and_publishes_manifest_last(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            hashes = {'ve.pt': hashlib.sha256(b'weights').hexdigest()}
            (root / 've.pt').write_bytes(b'weights')
            archive = root / 'pkuseg' / 'spacy_ontonotes.zip'
            archive.parent.mkdir()
            with zipfile.ZipFile(archive, 'w') as zipped:
                zipped.writestr('features.msgpack', b'features')
                zipped.writestr('weights.npz', b'weights')
                zipped.writestr('../escape', b'never extracted')
            digest = hashlib.sha256(archive.read_bytes()).hexdigest()
            with patch.object(expression_install, 'HASHES', hashes), patch.object(expression_install, 'SEGMENTER_SHA256', digest), patch.object(expression_install, 'download_snapshot'):
                expression_install.install_assets(root)
                self.assertTrue((root / 'experiment-manifest.json').is_file())
                self.assertEqual((root / 'pkuseg/spacy_ontonotes/features.msgpack').read_bytes(), b'features')
                self.assertFalse((root / 'pkuseg/escape').exists())
                manifest = json.loads((root / 'experiment-manifest.json').read_text())
                self.assertEqual(manifest['files']['ve.pt']['sha256'], hashes['ve.pt'])
                (root / 've.pt').write_bytes(b'corrupt')
                with self.assertRaisesRegex(ValueError, 'checksum'):
                    expression_install.install_assets(root)
                self.assertFalse((root / 'experiment-manifest.json').exists())
