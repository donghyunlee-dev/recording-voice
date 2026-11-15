"""Isolated CPU worker for the optional expressive engine.

Run with the engine's own interpreter; never import its dependencies in the API
environment. All assets must already exist locally before reference audio is read.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path

MODEL_REVISION = '5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18'
MODEL_ID = 'chatterbox-multilingual-v2'
SEGMENTER_SHA256 = 'b216e7f92de7ae285aeab8feba2faa8ea8216e5995ff6fb3d391cc8356db1bfe'


def validate_request(request: dict) -> dict:
    text = request.get('text')
    intensity = request.get('intensity', 0.5)
    if not isinstance(text, str) or not text.strip() or len(text) > 1000:
        raise ValueError('invalid_expression_text')
    if isinstance(intensity, bool) or not isinstance(intensity, (int, float)) or not math.isfinite(intensity) or not 0 <= intensity <= 1:
        raise ValueError('invalid_expression_intensity')
    return {**request, 'text': text.strip(), 'intensity': float(intensity)}


def verify_assets(directory: Path) -> None:
    manifest = json.loads((directory / 'experiment-manifest.json').read_text(encoding='utf-8'))
    if manifest.get('revision') != MODEL_REVISION:
        raise ValueError('expression_revision_mismatch')
    required = {'ve.pt', 's3gen.pt', 't3_mtl23ls_v2.safetensors', 'grapheme_mtl_merged_expanded_v1.json', 'Cangjie5_TC.json'}
    if set(manifest.get('files', {})) != required:
        raise ValueError('expression_assets_incomplete')
    for name in required:
        with (directory / name).open('rb') as source:
            digest = hashlib.file_digest(source, 'sha256').hexdigest()
        if digest != manifest['files'][name]['sha256']:
            raise ValueError('expression_asset_corrupt')
    if not (directory / 'pkuseg' / 'spacy_ontonotes' / 'features.msgpack').is_file() or not (directory / 'pkuseg' / 'spacy_ontonotes' / 'weights.npz').is_file():
        raise ValueError('expression_segmenter_missing')
    archive = directory / 'pkuseg' / 'spacy_ontonotes.zip'
    if not archive.is_file():
        raise ValueError('expression_segmenter_archive_missing')
    with archive.open('rb') as source:
        if hashlib.file_digest(source, 'sha256').hexdigest() != SEGMENTER_SHA256:
            raise ValueError('expression_segmenter_archive_corrupt')


def generate(request: dict, model_directory: Path, output_directory: Path) -> None:
    import random
    import sys
    import time

    request = validate_request(request)
    verify_assets(model_directory)
    reference = Path(request['reference'])
    if not reference.is_file():
        raise ValueError('recording_audio_missing')
    output_directory.mkdir(parents=True, exist_ok=False)

    def status(phase: str, **metadata):
        temporary = output_directory / 'status.tmp'
        temporary.write_text(json.dumps({'status': phase, **metadata}), encoding='utf-8')
        temporary.replace(output_directory / 'status.json')

    # These settings are established before importing any engine dependency.
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    os.environ['PKUSEG_HOME'] = str(model_directory / 'pkuseg')

    def deny_network(event, _args):
        if event in {'socket.connect', 'socket.getaddrinfo'}:
            raise RuntimeError('expression_network_access_blocked')

    sys.addaudithook(deny_network)
    status('loading_model')
    try:
        import numpy as np
        import soundfile as sf
        import torch
        import chatterbox.models.tokenizers.tokenizer as tokenizer
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        if __package__:
            from .generation import peak_rss_mib
        else:
            from generation import peak_rss_mib

        # Upstream 0.1.7 requests this pinned local asset through a mutable Hub ref.
        def local_mapping(*, repo_id, filename, **_kwargs):
            if repo_id != 'ResembleAI/chatterbox' or filename != 'Cangjie5_TC.json':
                raise ValueError('unexpected_expression_asset')
            return str(model_directory / filename)

        tokenizer.hf_hub_download = local_mapping
        torch.set_num_threads(4)
        random.seed(42)
        np.random.seed(42)
        torch.manual_seed(42)
        started = time.perf_counter()
        model = ChatterboxMultilingualTTS.from_local(model_directory, device='cpu')
        loaded = time.perf_counter() - started
        status('generating')
        random.seed(42)
        np.random.seed(42)
        torch.manual_seed(42)
        started = time.perf_counter()
        audio = model.generate(request['text'], language_id='ko', audio_prompt_path=str(reference), exaggeration=request['intensity'], cfg_weight=0.5)
        elapsed = time.perf_counter() - started
        samples = audio.squeeze(0).numpy()
        if not samples.size or not np.isfinite(samples).all():
            raise ValueError('expression_audio_invalid')
        sf.write(output_directory / 'audio.wav', samples, model.sr, subtype='PCM_16')
        status('completed', model_id=MODEL_ID, model_revision=MODEL_REVISION,
               intensity=request['intensity'], cfg_weight=0.5, seed=42,
               model_load_seconds=round(loaded, 3), generation_seconds=round(elapsed, 3), peak_rss_mib=peak_rss_mib())
    except Exception as error:
        status('failed', error_type=type(error).__name__, error=str(error))
        raise


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--request', required=True, type=Path)
    parser.add_argument('--model', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    generate(json.loads(args.request.read_text(encoding='utf-8')), args.model, args.output)
