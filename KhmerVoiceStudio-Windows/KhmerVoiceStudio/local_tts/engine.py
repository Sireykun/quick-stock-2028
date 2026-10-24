import io
import os
from pathlib import Path
import re
import subprocess
import threading
import unicodedata
import wave

import numpy as np
import regex

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = Path(os.environ.get('KHMER_TTS_MODEL', ROOT / 'models' / 'mms-khm')).resolve()
MAX_CHARACTERS = 1500


class StudioError(Exception):
    def __init__(self, code, status=400):
        self.code, self.status = code, status


def ffmpeg_path():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def text_chunks(text, limit=180):
    """Bound VITS inputs without splitting a Unicode grapheme cluster."""
    text = unicodedata.normalize('NFC', text.strip())
    chunks = []
    for sentence in re.split(r'(?<=[។!?\n])', text):
        clusters = regex.findall(r'\X', sentence.strip())
        while clusters:
            count, length = 0, 0
            for item in clusters:
                if count and length + len(item) > limit:
                    break
                length += len(item)
                count += 1
            if count < len(clusters):
                spaces = [i + 1 for i, item in enumerate(clusters[:count]) if item.isspace()]
                if spaces and spaces[-1] >= count // 2:
                    count = spaces[-1]
            chunk = ''.join(clusters[:count]).strip()
            if chunk:
                chunks.append(chunk)
            clusters = clusters[count:]
    return chunks


def wav_bytes(samples, sample_rate=16000):
    out = io.BytesIO()
    with wave.open(out, 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(sample_rate)
        audio.writeframes((np.clip(samples, -1, 1) * 32767).astype('<i2').tobytes())
    return out.getvalue()


class LocalEngine:
    def __init__(self, model_path=MODEL_PATH):
        self.model_path = Path(model_path)
        self.model = self.tokenizer = self.romanizer = None
        self.lock = threading.Lock()

    def load(self):
        if self.model is not None:
            return
        if not (self.model_path / 'config.json').exists():
            raise StudioError('model_missing', 503)
        try:
            import torch
            from transformers import AutoTokenizer, VitsModel
            torch.set_num_threads(min(4, os.cpu_count() or 1))
            tokenizer = AutoTokenizer.from_pretrained(str(self.model_path), local_files_only=True)
            model = VitsModel.from_pretrained(str(self.model_path), local_files_only=True, use_safetensors=True)
            model.eval()
            if getattr(tokenizer, 'is_uroman', False):
                from uroman import Uroman
                self.romanizer = Uroman()
            self.tokenizer, self.model = tokenizer, model
        except StudioError:
            raise
        except Exception:
            raise StudioError('model_load_failed', 503) from None

    def voices(self):
        with self.lock:
            self.load()
        return [{'id': 'local-khmer', 'label': 'សំឡេងខ្មែរ · ម៉ូដែលក្នុងកុំព្យូទ័រ'}]

    def synthesize(self, text, rate):
        if not self.lock.acquire(blocking=False):
            raise StudioError('provider_busy', 429)
        try:
            self.load()
            import torch
            self.model.speaking_rate = rate
            parts = []
            sampling_rate = self.model.config.sampling_rate
            with torch.inference_mode():
                torch.manual_seed(42)
                for chunk in text_chunks(text):
                    normalized = self.romanizer.romanize_string(chunk) if self.romanizer else chunk
                    inputs = self.tokenizer(normalized, return_tensors='pt')
                    if inputs.input_ids.numel() < 2:
                        raise StudioError('invalid_text')
                    part = self.model(**inputs).waveform.squeeze().cpu().numpy()
                    if not np.isfinite(part).all() or part.size == 0:
                        raise StudioError('invalid_audio', 500)
                    if parts:
                        parts.append(np.zeros(round(sampling_rate * 0.15), dtype=np.float32))
                    parts.append(part)
            audio = wav_bytes(np.concatenate(parts), sampling_rate)
            converted = subprocess.run([ffmpeg_path(), '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-f', 'mp3', '-b:a', '96k', 'pipe:1'], input=audio, capture_output=True, timeout=120)
            if converted.returncode or len(converted.stdout) < 100:
                raise StudioError('invalid_audio', 500)
            return converted.stdout, sampling_rate
        finally:
            self.lock.release()
