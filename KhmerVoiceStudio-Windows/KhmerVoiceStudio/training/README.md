# Improve the voice with your recordings

First collect and review real speech in the recording studio. No training run has started: your recordings are not available yet, and the development environment has no GPU. The setup below prepares a reproducible run; it has not been tested through an actual optimization run.

## 1. Record and review

Use your own voice, or recordings that the speaker has agreed can be used for training. Start with one speaker and one microphone. Read the 100 provided prompts, then add different sentences in the editable text box. Aim for at least 100 distinct clean clips and roughly 30 minutes of varied speech for an initial experiment. More suitable data may be needed. A longer dataset with incorrect transcripts can be worse than a smaller clean one.

Listen to every clip. The transcript must match exactly, including repeated or omitted words. Avoid background music, other voices, reverb, clipping, and long silence. Do not denoise aggressively: artifacts can be learned by the model. Use 3–15 second utterances.

The app's ZIP contains WAV files plus `metadata.jsonl`. Extract it before preparation. Raw local `recordings/` is also supported.

## 2. Audit and make separate splits

From the app folder, using the installed Python environment:

```text
.venv\Scripts\python.exe training\prepare.py --recordings recordings --output training\data
```

The validator rejects malformed audio, changed hashes, repeated recordings/transcripts, overly quiet recordings, severe clipping, and files outside the dataset folder. It creates a deterministic 80/10/10 train/validation/test split, compatible with Hugging Face AudioFolder. The minimum is 100 accepted distinct clips. Review `audit.json`; acoustic checks cannot verify whether spoken words match the text.

Keep `test/` untouched during training. Do not use test recordings to choose checkpoints.

## 3. Prepare a GPU training environment

Inference and recording use the CPU build installed on Windows. This training recipe needs an NVIDIA CUDA GPU and a separate environment with the appropriate CUDA-enabled PyTorch. Linux or WSL2 with a working NVIDIA GPU is the recommended training environment. Nothing here rents a GPU or starts a paid cloud service. A free hosted notebook GPU can be an alternative if available, but its availability and runtime limits are outside this app.

The recipe is the one linked by Meta's MMS project:
https://github.com/ylacombe/finetune-hf-vits

Pin its reviewed source commit:

```sh
git clone https://github.com/ylacombe/finetune-hf-vits.git training/recipe
git -C training/recipe checkout 6f3f51f4d667f5c3eef89484d151ffd39d2c2b89
python -m pip install -r training/requirements.txt
cd training/recipe/monotonic_align
mkdir -p monotonic_align
python setup.py build_ext --inplace
cd ../../..
```

Install an appropriate CUDA PyTorch version using the official instructions for your GPU environment. The local inference app was checked with PyTorch 2.6.0; the training environment must be tested separately. A compiler is needed for the alignment extension.

## 4. Convert the Khmer checkpoint for training

MMS inference weights alone do not include the discriminator required for this training recipe. The official converter downloads and adds it:

```sh
python training/recipe/convert_original_discriminator_checkpoint.py \
  --language_code khm \
  --pytorch_dump_folder_path models/khmer-train-base
```

This requires access to the public Meta repositories on Hugging Face. No upload or Hugging Face login is requested. The base and the resulting model remain subject to CC-BY-NC-4.0.

## 5. Run a short experiment

```sh
python training/train.py \
  --recipe training/recipe \
  --model models/khmer-train-base \
  --data training/data \
  --output models/my-khmer-voice \
  --steps 1000
```

The launcher checks for CUDA and an audited dataset, preserves checkpoints, uses validation separately, disables model uploads and telemetry, and uses Python Uroman instead of requiring Perl. Start with a short experiment and inspect losses, output audio, and GPU memory. Do not assume 1,000 steps or the supplied learning rate will be optimal for your recordings.

## 6. Compare before changing the app

Generate the same 10–20 unseen Khmer sentences with both the base and fine-tuned model. Listen for missing words, repeats, pronunciation of Khmer clusters, names and numbers, pauses, noise, and voice consistency. Ask a fluent Khmer speaker to compare them without knowing which model produced which file. A lower loss alone is not proof of better speech.

If the fine-tuned checkpoint is better, run these commands from the app folder in Windows Command Prompt:

```bat
set "KHMER_TTS_MODEL=%CD%\models\my-khmer-voice"
Start-Windows.bat
```

Keep the base model folder as a fallback. Neither recording nor training automatically publishes your dataset or replaces your app's voice.
