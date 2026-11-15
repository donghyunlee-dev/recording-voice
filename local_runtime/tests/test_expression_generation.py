import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from local_runtime.app.expression_generation import ExpressionGenerationError, ExpressionGenerator


class ExpressionGenerationTests(unittest.TestCase):
    def test_isolated_worker_returns_audio_and_actual_settings(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            worker = root / 'worker.py'
            worker.write_text('''import argparse,json,wave
from pathlib import Path
p=argparse.ArgumentParser()
for key in ['request','model','output']: p.add_argument('--'+key)
a=p.parse_args(); request=json.loads(Path(a.request).read_text(encoding='utf-8'))
out=Path(a.output); out.mkdir()
with wave.open(str(out/'audio.wav'),'wb') as wav:
 wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(24000); wav.writeframes(b'\\0'*4800)
(out/'status.json').write_text(json.dumps({'status':'completed','model_id':'chatterbox-multilingual-v2','intensity':request['intensity'],'model_load_seconds':1,'generation_seconds':2,'peak_rss_mib':100}))
''')
            reference = root / 'reference.wav'
            reference.write_bytes(b'preserve reference')
            phases = []
            with patch('local_runtime.app.expression_generation.WORKER_PATH', worker):
                engine = ExpressionGenerator(Path(sys.executable), root, timeout_seconds=5)
                audio, metrics = engine.generate(audio_path=reference, text='새 대본', intensity=0.8, on_phase=phases.append)
            self.assertTrue(audio.startswith(b'RIFF'))
            self.assertEqual(metrics['intensity'], 0.8)
            self.assertEqual(metrics['generation_seconds'], 2)
            self.assertEqual(phases, ['loading_model', 'generating'])
            self.assertEqual(reference.read_bytes(), b'preserve reference')

    def test_worker_timeout_and_failure_remain_explicit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            worker = root / 'worker.py'
            reference = root / 'reference.wav'
            reference.touch()
            for source, expected in [('import time; time.sleep(30)', 'expression_timeout'), ('raise RuntimeError("worker failed")', 'expression_worker_failed')]:
                engine = ExpressionGenerator(Path(sys.executable), root, timeout_seconds=0.15 if expected == 'expression_timeout' else 5)
                worker.write_text(source)
                with self.subTest(expected=expected), patch('local_runtime.app.expression_generation.WORKER_PATH', worker), self.assertRaisesRegex(ExpressionGenerationError, expected):
                    engine.generate(audio_path=reference, text='대본', intensity=0.5, on_phase=lambda _: None)
