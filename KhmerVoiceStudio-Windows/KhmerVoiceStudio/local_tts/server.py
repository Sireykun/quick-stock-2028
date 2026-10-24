import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import threading
import uuid
import wave
import zipfile

import numpy as np
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.concurrency import run_in_threadpool
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .engine import LocalEngine, MAX_CHARACTERS, ROOT, StudioError, ffmpeg_path

DATA = Path(os.environ.get('KHMER_RECORDINGS_DIR', ROOT / 'recordings')).resolve()
app = FastAPI(docs_url=None, redoc_url=None)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=['127.0.0.1', 'localhost', '[::1]', 'testserver'])
engine = LocalEngine()
recording_lock = threading.Lock()


@app.middleware('http')
async def local_boundary(request, call_next):
    if request.method not in ('GET', 'HEAD'):
        origin = request.headers.get('origin')
        if request.headers.get('sec-fetch-site') == 'cross-site' or (origin and origin != f'{request.url.scheme}://{request.url.netloc}'):
            return JSONResponse({'error': 'forbidden'}, status_code=403)
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; media-src 'self' blob:; connect-src 'self'; img-src 'self' data:; base-uri 'none'; object-src 'none'; frame-ancestors 'none'"
    return response


@app.exception_handler(StudioError)
async def studio_error(request, error):
    return JSONResponse({'error': error.code}, status_code=error.status)


async def limited_body(request, limit):
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > limit:
            raise StudioError('too_large', 413)
    return bytes(body)


def validate_text(text, limit=MAX_CHARACTERS):
    if not isinstance(text, str) or not text.strip() or len(text) > limit:
        raise StudioError('text_length')
    if not re.search('[\u1780-\u17b3]', text):
        raise StudioError('khmer_required')
    if re.search('[\x00-\x08\x0b\x0c\x0e-\x1f\ud800-\udfff]', text):
        raise StudioError('invalid_text')
    return text.strip()


@app.get('/api/health')
def health():
    return {'local': True, 'modelInstalled': (engine.model_path / 'config.json').exists()}


@app.get('/api/voices')
def voices():
    return {'provider': 'Meta MMS · local', 'voices': engine.voices(), 'maxCharacters': MAX_CHARACTERS}


@app.post('/api/speech')
async def speech(request: Request):
    if not request.headers.get('content-type', '').startswith('application/json'):
        raise StudioError('invalid_input', 415)
    try:
        payload = json.loads(await limited_body(request, 16000))
    except (ValueError, UnicodeError):
        raise StudioError('invalid_input') from None
    if not isinstance(payload, dict):
        raise StudioError('invalid_input')
    text = validate_text(payload.get('text'))
    rate = payload.get('rate')
    if type(rate) not in (float, int) or not 0.7 <= rate <= 1.3:
        raise StudioError('invalid_rate')
    if payload.get('voice') != 'local-khmer':
        raise StudioError('invalid_voice')
    audio, sample_rate = await run_in_threadpool(engine.synthesize, text, rate)
    return Response(audio, media_type='audio/mpeg', headers={'Content-Disposition': 'attachment; filename="khmer-voice.mp3"', 'X-Audio-Sample-Rate': str(sample_rate)})


def save_recording(body, text):
    # Decode at most 21 seconds, bound output memory, keep only mono PCM for training.
    result = subprocess.run([ffmpeg_path(), '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-t', '21', '-ac', '1', '-ar', '16000', '-f', 's16le', 'pipe:1'], input=body, capture_output=True, timeout=30)
    if result.returncode or not result.stdout:
        raise StudioError('recording_invalid')
    samples = np.frombuffer(result.stdout, dtype='<i2').astype(np.float32) / 32768
    duration = len(samples) / 16000
    if not 2 <= duration <= 20:
        raise StudioError('recording_duration')
    rms = float(np.sqrt(np.mean(samples ** 2)))
    clipped = float(np.mean(np.abs(samples) >= .995))
    if rms < .002:
        raise StudioError('recording_quiet')
    clip_id = uuid.uuid4().hex
    stream = io.BytesIO()
    with wave.open(stream, 'wb') as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(16000); wav.writeframes(result.stdout)
    wav_data = stream.getvalue()
    metadata = {'id': clip_id, 'audio_file': f'wavs/{clip_id}.wav', 'text': text, 'speaker_id': 'my_voice', 'duration': round(duration, 3), 'sample_rate': 16000, 'rms': round(rms, 5), 'clipped_fraction': round(clipped, 5), 'sha256': hashlib.sha256(wav_data).hexdigest()}
    with recording_lock:
        (DATA / 'wavs').mkdir(parents=True, exist_ok=True)
        (DATA / 'wavs' / f'{clip_id}.wav').write_bytes(wav_data)
        (DATA / f'{clip_id}.json').write_text(json.dumps(metadata, ensure_ascii=False), encoding='utf-8')
    return metadata


@app.post('/api/recordings')
async def record(request: Request):
    # The transcript is a short UTF-8 JSON header-independent query value; never logged by uvicorn.
    text = validate_text(request.query_params.get('text'), 500)
    body = await limited_body(request, 10_000_000)
    return await run_in_threadpool(save_recording, body, text)


def recording_items():
    with recording_lock:
        if not DATA.exists():
            return []
        return [json.loads(p.read_text(encoding='utf-8')) for p in sorted(DATA.glob('*.json'))]


@app.get('/api/recordings')
def recordings():
    items = recording_items()
    return {'count': len(items), 'minutes': round(sum(x['duration'] for x in items) / 60, 1), 'items': items}


@app.get('/api/recordings/export')
def export_recordings():
    items = recording_items()
    if not items:
        raise StudioError('no_recordings')
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('metadata.jsonl', '\n'.join(json.dumps(x, ensure_ascii=False) for x in items) + '\n')
        for item in items:
            z.write(DATA / item['audio_file'], item['audio_file'])
        z.writestr('README.txt', 'Your Khmer voice recordings. Mono, 16 kHz, PCM WAV. metadata.jsonl pairs each audio file with its transcript. Review every clip before training. Do not publish recordings without the speaker\'s permission.\n')
    return Response(archive.getvalue(), media_type='application/zip', headers={'Content-Disposition': 'attachment; filename="khmer-training-recordings.zip"'})


@app.get('/')
def home():
    return FileResponse(ROOT / 'src/index.html')


@app.get('/record')
def record_page():
    return FileResponse(ROOT / 'src/record.html')


@app.get('/{asset}')
def assets(asset: str):
    if asset not in ('app.js', 'styles.css', 'record.js', 'prompts.json'):
        raise StudioError('not_found', 404)
    return FileResponse(ROOT / 'src' / asset)
