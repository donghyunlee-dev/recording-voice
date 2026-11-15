import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from local_runtime.app.expression_worker import MODEL_REVISION, validate_request, verify_assets


class ExpressionWorkerTests(unittest.TestCase):
    def test_accepts_bounded_intensity_and_preserves_script(self):
        result = validate_request({'text': '  반가워요.\n다시 만났네요.  ', 'intensity': 0.8})
        self.assertEqual(result['text'], '반가워요.\n다시 만났네요.')
        self.assertEqual(result['intensity'], 0.8)
        for invalid in [-0.1, 1.1, float('nan'), float('inf'), True, '0.5']:
            with self.subTest(invalid=invalid), self.assertRaisesRegex(ValueError, 'invalid_expression_intensity'):
                validate_request({'text': '대본', 'intensity': invalid})

    def test_rejects_empty_or_oversized_script(self):
        for text in ['', '  ', None, '가' * 1001]:
            with self.subTest(text=text), self.assertRaisesRegex(ValueError, 'invalid_expression_text'):
                validate_request({'text': text})

    def test_requires_complete_pinned_assets_and_detects_corruption(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            names = ['ve.pt', 's3gen.pt', 't3_mtl23ls_v2.safetensors', 'grapheme_mtl_merged_expanded_v1.json', 'Cangjie5_TC.json']
            manifest = {'revision': MODEL_REVISION, 'files': {}}
            for name in names:
                content = name.encode()
                (root / name).write_bytes(content)
                manifest['files'][name] = {'sha256': hashlib.sha256(content).hexdigest()}
            (root / 'experiment-manifest.json').write_text(json.dumps(manifest))
            segmenter = root / 'pkuseg' / 'spacy_ontonotes'
            segmenter.mkdir(parents=True)
            (segmenter / 'features.msgpack').write_bytes(b'features')
            (segmenter / 'weights.npz').write_bytes(b'weights')
            with self.assertRaisesRegex(ValueError, 'expression_segmenter_archive_missing'):
                verify_assets(root)
            archive = root / 'pkuseg' / 'spacy_ontonotes.zip'
            archive.write_bytes(b'test archive')
            with patch('local_runtime.app.expression_worker.SEGMENTER_SHA256', hashlib.sha256(archive.read_bytes()).hexdigest()):
                verify_assets(root)
            (root / 've.pt').write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError, 'expression_asset_corrupt'):
                verify_assets(root)
