"""Download once, then inference runs entirely locally. No API account is needed."""
from pathlib import Path
import sys
from huggingface_hub import snapshot_download
from .engine import ROOT


def main():
    target = ROOT / 'models/mms-khm'
    print('Downloading Meta MMS Khmer (CC-BY-NC-4.0, non-commercial). About 150 MB of model weights.')
    try:
        snapshot_download('facebook/mms-tts-khm', local_dir=target, allow_patterns=['config.json', 'model.safetensors', 'tokenizer_config.json', 'vocab.json', 'special_tokens_map.json', 'README.md'])
        if not (target / 'model.safetensors').exists():
            raise RuntimeError('The safetensors weights were not downloaded.')
    except Exception as error:
        print(f'Model download did not finish ({type(error).__name__}). Check your Internet/network policy and retry. The recording studio works without this model.', file=sys.stderr)
        return 2
    print(f'Model saved to {target}. Speech generation now works offline after the first load.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
