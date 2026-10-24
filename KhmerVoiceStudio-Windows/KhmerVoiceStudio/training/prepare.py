"""Audit local recordings and make non-overlapping audiofolder training splits."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import random
import shutil
import wave
import numpy as np


def prepare(source, destination, min_clips=100):
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if destination.exists():
        raise ValueError('Output already exists. Choose a new output folder to preserve previous work.')
    manifest = source / 'metadata.jsonl'
    items = [json.loads(line) for line in manifest.read_text(encoding='utf-8').splitlines() if line.strip()] if manifest.exists() else [json.loads(p.read_text(encoding='utf-8')) for p in sorted(source.glob('*.json'))]
    accepted, rejected, hashes, texts = [], [], set(), set()
    for item in items:
        try:
            path = (source / item['audio_file']).resolve()
            if not path.is_relative_to(source):
                raise ValueError('path escapes dataset folder')
            text = item.get('text', '').strip()
            if not text or len(text) > 500:
                raise ValueError('missing or too-long transcript')
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if item.get('sha256') and item['sha256'] != digest:
                raise ValueError('audio changed after recording')
            if digest in hashes or text in texts:
                raise ValueError('duplicate audio or transcript; keep the best take only')
            with wave.open(str(path)) as wav:
                if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) != (1, 2, 16000):
                    raise ValueError('requires mono 16 kHz 16-bit WAV')
                samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').astype(np.float32) / 32768
            duration = len(samples) / 16000
            if not 2 <= duration <= 20:
                raise ValueError('duration must be 2–20 seconds')
            if np.sqrt(np.mean(samples ** 2)) < .002:
                raise ValueError('recording too quiet')
            if np.mean(np.abs(samples) >= .995) > .001:
                raise ValueError('recording clips; lower microphone gain and retake')
            hashes.add(digest); texts.add(text)
            accepted.append({**item, 'text': text, 'path': path, 'duration': duration})
        except (KeyError, OSError, ValueError, wave.Error) as error:
            rejected.append({'audio_file': item.get('audio_file'), 'reason': str(error)})
    report = {'accepted': len(accepted), 'rejected': rejected, 'minutes': round(sum(x['duration'] for x in accepted) / 60, 2), 'trained': False}
    if len(accepted) < min_clips:
        raise ValueError(json.dumps({**report, 'error': f'Need at least {min_clips} clean, distinct clips before preparing training.'}, ensure_ascii=False, indent=2))
    if len({x.get('speaker_id', 'my_voice') for x in accepted}) != 1:
        raise ValueError('Use a single consistent speaker for this first voice fine-tune.')
    random.Random(42).shuffle(accepted)
    n = max(1, len(accepted) // 10)
    splits = {'test': accepted[:n], 'validation': accepted[n:2*n], 'train': accepted[2*n:]}
    for name, records in splits.items():
        folder = destination / name
        folder.mkdir(parents=True)
        with (folder / 'metadata.csv').open('w', encoding='utf-8', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=['file_name', 'text'])
            writer.writeheader()
            for i, item in enumerate(records):
                filename = f'{i:05}.wav'
                shutil.copyfile(item['path'], folder / filename)
                writer.writerow({'file_name': filename, 'text': item['text']})
    report['splits'] = {k: len(v) for k, v in splits.items()}
    (destination / 'audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--recordings', default='recordings')
    parser.add_argument('--output', default='training/data')
    parser.add_argument('--min-clips', type=int, default=100)
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(args.recordings, args.output, args.min_clips), ensure_ascii=False, indent=2))
    except ValueError as error:
        parser.exit(2, str(error) + '\n')
