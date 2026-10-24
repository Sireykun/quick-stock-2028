"""Launch the official MMS fine-tuning recipe with local data and no uploads."""
import argparse
import json
import os
from pathlib import Path
import runpy
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--recipe', required=True, help='Checkout of ylacombe/finetune-hf-vits at the documented commit')
    parser.add_argument('--model', required=True, help='Converted Khmer training checkpoint including discriminator')
    parser.add_argument('--data', default='training/data')
    parser.add_argument('--output', default='models/my-khmer-voice')
    parser.add_argument('--steps', type=int, default=1000)
    args = parser.parse_args()
    import torch
    if not torch.cuda.is_available():
        parser.exit(2, 'Training needs an NVIDIA CUDA GPU with this recipe. The Windows CPU app still works for speech and recording. No paid GPU will be started.\n')
    recipe, data, model, output = [Path(p).resolve() for p in (args.recipe, args.data, args.model, args.output)]
    if not (data / 'audit.json').exists():
        parser.exit(2, 'Run training/prepare.py and review the recordings first.\n')
    if not (model / 'config.json').exists():
        parser.exit(2, 'Convert the official Khmer checkpoint with its discriminator first; see training/README.md.\n')
    config = {
        'project_name': 'my_khmer_voice', 'model_name_or_path': str(model),
        'dataset_name': str(data), 'audio_column_name': 'audio', 'text_column_name': 'text',
        'train_split_name': 'train', 'eval_split_name': 'validation',
        'output_dir': str(output), 'overwrite_output_dir': False, 'push_to_hub': False,
        'report_to': [], 'do_train': True, 'do_eval': True, 'max_steps': args.steps,
        'per_device_train_batch_size': 4, 'per_device_eval_batch_size': 2,
        'gradient_accumulation_steps': 2, 'learning_rate': 2e-5,
        'adam_beta1': .8, 'adam_beta2': .99, 'warmup_ratio': .01,
        'max_duration_in_seconds': 20, 'min_duration_in_seconds': 2,
        'max_tokens_length': 500, 'preprocessing_num_workers': 1,
        'eval_steps': 100, 'save_steps': 100, 'save_total_limit': 2,
        'max_eval_samples': 20, 'weight_disc': 3, 'weight_fmaps': 1,
        'weight_gen': 1, 'weight_kl': 1.5, 'weight_duration': 1, 'weight_mel': 35,
        'fp16': False, 'seed': 42, 'uroman_path': 'python-uroman',
    }
    config_path = data.parent / 'run-config.json'
    config_path.write_text(json.dumps(config, indent=2), encoding='utf-8')
    # Keep all training output local. Replace only the recipe's Perl romanization helper.
    os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
    os.environ['WANDB_DISABLED'] = 'true'
    sys.path.insert(0, str(recipe))
    from uroman import Uroman
    romanizer = Uroman()
    import utils
    utils.uromanize = lambda text, uroman_path: romanizer.romanize_string(text)
    sys.argv = [str(recipe / 'run_vits_finetuning.py'), str(config_path)]
    runpy.run_path(sys.argv[0], run_name='__main__')


if __name__ == '__main__':
    main()
