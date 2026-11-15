"""Install pinned expressive assets without accessing recordings or output data."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
import urllib.request
import zipfile

from .expression_worker import MODEL_REVISION, SEGMENTER_SHA256

HASHES = {
    've.pt': '4b16d836bc598509860f6fa068165a8bb5e9ac84f05582dfcf278a5a372879f1',
    's3gen.pt': '9b9ff07e60b20c136e2b1b3d7563a24604e8d2c4c267888d1ee929dd0151d2a3',
    't3_mtl23ls_v2.safetensors': 'b1237586127ce98e7800a68e49938eb5092846862aabcb6e17b2fda7889a6c75',
    'grapheme_mtl_merged_expanded_v1.json': '69632f47220a788a52ce2661d096453c5655e9bf25289d89a8d832c46ee07dbf',
    'Cangjie5_TC.json': '7073fd9de919443ae88e0bd2449917a65fe54898a4413ed1edcc4b67f28bce8c',
}
SEGMENTER_URL = 'https://github.com/explosion/spacy-pkuseg/releases/download/v0.0.26/spacy_ontonotes.zip'


def digest(path: Path) -> str:
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def download_snapshot(directory: Path) -> None:
    from huggingface_hub import snapshot_download
    snapshot_download(repo_id='ResembleAI/chatterbox', revision=MODEL_REVISION,
                      local_dir=directory, allow_patterns=list(HASHES), max_workers=2)


def install_assets(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    manifest = directory / 'experiment-manifest.json'
    # An incomplete repair must never advertise a usable installation.
    manifest.unlink(missing_ok=True)
    download_snapshot(directory)
    files = {}
    for name, expected in HASHES.items():
        path = directory / name
        if digest(path) != expected:
            raise ValueError(f'expression_asset_checksum: {name}')
        files[name] = {'bytes': path.stat().st_size, 'sha256': expected}
    archive = directory / 'pkuseg' / 'spacy_ontonotes.zip'
    archive.parent.mkdir(exist_ok=True)
    if not archive.is_file() or digest(archive) != SEGMENTER_SHA256:
        partial = archive.with_suffix('.download')
        try:
            with urllib.request.urlopen(SEGMENTER_URL, timeout=60) as source, partial.open('wb') as target:
                shutil.copyfileobj(source, target)
            if digest(partial) != SEGMENTER_SHA256:
                raise ValueError('expression_segmenter_checksum')
            partial.replace(archive)
        finally:
            partial.unlink(missing_ok=True)
    extracted = archive.parent / 'spacy_ontonotes'
    extracted.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive) as zipped:
        for name in ('features.msgpack', 'weights.npz'):
            with zipped.open(name) as source, (extracted / name).open('wb') as target:
                shutil.copyfileobj(source, target)
    pending = manifest.with_suffix('.tmp')
    pending.write_text(json.dumps({'repository': 'ResembleAI/chatterbox', 'revision': MODEL_REVISION,
                                   'variant': 'multilingual-v2', 'files': files}, indent=2), encoding='utf-8')
    pending.replace(manifest)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    install_assets(parser.parse_args().directory)
