"""Run a local, offline Korean expression comparison without changing user data."""
import argparse
import hashlib
import json
import os
import random
import time
from pathlib import Path

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--model', required=True, type=Path)
parser.add_argument('--reference', required=True, type=Path)
parser.add_argument('--output', required=True, type=Path)
parser.add_argument('--threads', type=int, default=4)
args = parser.parse_args()
if args.threads < 1:
    parser.error('--threads must be positive')
manifest = json.loads((args.model / 'experiment-manifest.json').read_text(encoding='utf-8'))
for name, metadata in manifest['files'].items():
    with (args.model / name).open('rb') as source:
        if hashlib.file_digest(source, 'sha256').hexdigest() != metadata['sha256']:
            raise RuntimeError(f'Model checksum mismatch: {name}')
reference_hash = hashlib.sha256(args.reference.read_bytes()).hexdigest()
args.output.mkdir(parents=True, exist_ok=False)
report = {
    'model': manifest, 'reference_sha256': reference_hash,
    'text': '안녕하세요. 오늘은 제가 좋아하는 책을 읽어보겠습니다.',
    'device': 'cpu', 'threads': args.threads, 'seed': 42,
    'status': 'loading', 'results': [], 'listening_accepted': False,
}


def save_report():
    (args.output / 'trial.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')


save_report()
try:
    import numpy as np
    import soundfile as sf
    import torch
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    torch.set_num_threads(args.threads)
    started = time.perf_counter()
    model = ChatterboxMultilingualTTS.from_local(args.model, device='cpu')
    report['model_load_seconds'] = round(time.perf_counter() - started, 3)
    for intensity in (0.5, 0.8):
        report['status'] = f'generating_{intensity}'
        save_report()
        random.seed(42)
        np.random.seed(42)
        torch.manual_seed(42)
        started = time.perf_counter()
        wav = model.generate(report['text'], language_id='ko', audio_prompt_path=str(args.reference), exaggeration=intensity, cfg_weight=0.5)
        elapsed = time.perf_counter() - started
        samples = wav.squeeze(0).numpy()
        if not samples.size or not np.isfinite(samples).all():
            raise RuntimeError('Generated audio is empty or non-finite')
        filename = f'intensity-{intensity}.wav'
        sf.write(args.output / filename, samples, model.sr, subtype='PCM_16')
        report['results'].append({
            'file': filename, 'exaggeration': intensity, 'cfg_weight': 0.5,
            'generation_seconds': round(elapsed, 3), 'duration_seconds': len(samples) / model.sr,
            'sample_rate': model.sr, 'peak': float(np.max(np.abs(samples))),
            'clipping_fraction': float(np.mean(np.abs(samples) >= 1)),
        })
        save_report()
    report['status'] = 'generated'
except BaseException as error:
    report['status'] = 'failed'
    report['error'] = f'{type(error).__name__}: {error}'
    raise
finally:
    report['reference_unchanged'] = hashlib.sha256(args.reference.read_bytes()).hexdigest() == reference_hash
    save_report()
