"""Check the isolated Chatterbox experiment without downloading model weights."""
import inspect
import json
import os
from importlib.metadata import version

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'

import torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

parameters = inspect.signature(ChatterboxMultilingualTTS.generate).parameters
assert {'text', 'language_id', 'audio_prompt_path', 'exaggeration'}.issubset(parameters)
assert 'ko' in ChatterboxMultilingualTTS.get_supported_languages()
assert torch.version.cuda is None, 'Experiment requires CPU-only PyTorch'
print(json.dumps({
    'status': 'passed',
    'packages': {name: version(name) for name in ['chatterbox-tts', 'torch', 'torchaudio', 'transformers']},
    'korean': True,
    'reference_audio': True,
    'expression_intensity_parameter': True,
    'model_loaded': False,
    'inference_executed': False,
}))
