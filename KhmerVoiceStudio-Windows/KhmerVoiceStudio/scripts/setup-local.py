"""Cross-platform bootstrap; Windows users run Setup-Windows.bat."""
from pathlib import Path
import os
import subprocess
import sys
import venv

root = Path(__file__).resolve().parents[1]
os.chdir(root)
if not (3, 10) <= sys.version_info[:2] <= (3, 12):
    raise SystemExit('Install Python 3.12 (64-bit), then run Setup-Windows.bat again.')
environment = root / '.venv'
if not environment.exists():
    venv.EnvBuilder(with_pip=True).create(environment)
python = environment / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
def run(*args):
    subprocess.run([str(python), *args], check=True)

print('Installing the local runtime. No payment account or API key is required.', flush=True)
try:
    if sys.platform == 'darwin':
        run('-m', 'pip', 'install', 'torch==2.6.0')
    else:
        run('-m', 'pip', 'install', 'torch==2.6.0', '--index-url', 'https://download.pytorch.org/whl/cpu')
    run('-m', 'pip', 'install', '-r', 'requirements-local.txt')
except subprocess.CalledProcessError:
    raise SystemExit('Installation did not finish. Check your Internet connection, then run setup again.')
result = subprocess.run([str(python), '-m', 'local_tts.download'])
if result.returncode:
    print('The app is installed. Model download is still needed for speech. Recording already works.')
print('Next: double-click Start-Windows.bat. Keep its window open while using the studio.')
