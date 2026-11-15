"""Download only the pinned candidate weights into an explicit experiment folder."""
import argparse
import hashlib
import json
from pathlib import Path

from huggingface_hub import snapshot_download

REVISION = '5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18'
HASHES = {
    've.pt': '4b16d836bc598509860f6fa068165a8bb5e9ac84f05582dfcf278a5a372879f1',
    's3gen.pt': '9b9ff07e60b20c136e2b1b3d7563a24604e8d2c4c267888d1ee929dd0151d2a3',
    't3_mtl23ls_v2.safetensors': 'b1237586127ce98e7800a68e49938eb5092846862aabcb6e17b2fda7889a6c75',
}

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path)
args = parser.parse_args()
directory = Path(snapshot_download(
    repo_id='ResembleAI/chatterbox', revision=REVISION,
    local_dir=args.directory,
    allow_patterns=[*HASHES, 'grapheme_mtl_merged_expanded_v1.json', 'Cangjie5_TC.json'],
    max_workers=2,
))
files = {}
for name in [*HASHES, 'grapheme_mtl_merged_expanded_v1.json', 'Cangjie5_TC.json']:
    path = directory / name
    with path.open('rb') as source:
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
    if name in HASHES and digest != HASHES[name]:
        raise RuntimeError(f'Weight checksum mismatch: {name}')
    files[name] = {'bytes': path.stat().st_size, 'sha256': digest}
manifest = {'repository': 'ResembleAI/chatterbox', 'revision': REVISION, 'variant': 'multilingual-v2', 'files': files}
(directory / 'experiment-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(json.dumps(manifest), flush=True)
