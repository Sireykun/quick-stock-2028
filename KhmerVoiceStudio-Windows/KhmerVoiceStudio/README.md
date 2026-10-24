# Khmer Voice Studio — Windows local edition

A local web app for Khmer text-to-speech and recording your own training samples. No Azure subscription, API key, or usage billing. Your computer performs inference; internet is needed for the initial package/model downloads.

## Windows: start here

1. Install **Python 3.12, 64-bit** from https://www.python.org/downloads/windows/ if you do not already have it. Enable the Python launcher during installation.
2. Extract the entire ZIP into a normal folder, such as `Documents\KhmerVoiceStudio`. Do not run files from inside the ZIP viewer.
3. Double-click **Setup-Windows.bat** once. Keep its window open while dependencies and the roughly 150 MB Khmer model download. Allow a few GB of disk space for the full Python runtime and packages.
4. Double-click **Start-Windows.bat**. It opens `http://127.0.0.1:8765` in your browser. Keep the console open while using the app; Ctrl+C stops it.
5. If the model download did not finish, run **Download-Model.bat**, then restart the app. The recording studio works before the model is installed.

Use current Chrome or Edge for microphone recording. The app listens only on your own computer. A phone cannot use this localhost address. The app contains no public hosting or remote API service.

## What works

- Khmer text entry, up to 1,500 characters.
- A local Meta MMS Khmer voice, with speaking speed adjustment, playback/pause and MP3 download.
- Longer text is split at sentences and grapheme boundaries, then joined with short pauses.
- A recording studio at `/record`, with **100 Khmer prompts**, microphone recording, playback before saving, and dataset ZIP export.
- Saved training clips are mono, 16 kHz, 16-bit WAV, paired with the exact text read.
- A dataset audit and split tool, plus a local GPU fine-tuning launcher.

There is one base voice, not an invented female/male selector. A later fine-tuned model can replace it by setting `KHMER_TTS_MODEL` to the checkpoint directory before starting the app. Only use model folders you trust.

## Record your voice

Open **ថតសំឡេងបង្រៀន** at the top of the app. Click **ចាប់ផ្តើមថត**, allow microphone access, and read the displayed sentence exactly. Click **បញ្ឈប់**, listen, then click **រក្សាទុកការថតនេះ** only for a clean take. Use **អត្ថបទបន្ទាប់** for the next prompt.

Use one speaker, the same microphone, a consistent distance, and a quiet room. Aim for 3–15 seconds per clip. The recorder stops after 18 seconds; the server accepts 2–20 seconds. Correct the transcript before recording, and retake when words do not match. Say numbers as written words for these first samples.

Recordings are saved under `recordings/` on your computer. Export ZIP makes a portable copy of your WAV files and `metadata.jsonl`. Closing the browser does not delete saved recordings. Export regularly to back up your work.

The 100 prompts are a starter pack. Record additional original sentences to reach about 30 minutes of clean, varied speech for a pilot. The amount needed for a good voice varies; an improvement is not guaranteed. Preserve new, unseen sentences for evaluation. Recording alone does not train the model. See `training/README.md` for the next stage.

## Model and license

Base model: [Meta facebook/mms-tts-khm](https://huggingface.co/facebook/mms-tts-khm), 36.3 million parameters, trained for Khmer. It uses **CC-BY-NC-4.0**: attribution and non-commercial use. Fine-tuning does not remove this restriction. The code uses Transformers' VITS implementation, with Uroman preprocessing when required by the model. Model loading is restricted to local files and safetensors; inference does not send text to an online service.

The interface may fetch its optional fonts from Google Fonts. Audio and text remain local. System font fallbacks work without internet.

## Verification and limits

Verified in the development Linux workspace:

- All seven Python checks passed: model-missing state, text validation, real FFmpeg audio conversion/save/export, recording bounds, local request restrictions, grapheme chunking, and distinct training splits.
- Chromium desktop/mobile checks passed for microphone capture with a test audio source, listening, saving, ZIP export, next-prompt navigation, and MP3 UI playback/download with a test tone.
- Python inference dependencies import correctly.

**Not yet verified:** real Khmer inference/pronunciation, actual model fine-tuning, and running the installers on Windows. The workspace proxy denied Hugging Face downloads, and it has neither model weights nor a GPU nor your recordings. No fake model is used, no training was claimed, and no paid compute was started. On your Windows computer, setup downloads the real model through your internet connection.

## Developer commands

Install CPU PyTorch separately, then `requirements-local.txt`. Node is not required to run the app; it is used only for optional automated browser checks.

```text
python -m local_tts.download
python scripts/start-local.py
python -m unittest discover -s tests -p test_local.py -v
```

Tests additionally require `httpx==0.28.1`. Browser test source is in `scripts/test-browser.mjs` and uses an isolated recording directory and generated test audio. Never train on the synthetic test fixtures.
