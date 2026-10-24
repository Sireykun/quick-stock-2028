from pathlib import Path
import os
import threading
import time
import urllib.request
import webbrowser
import uvicorn

root = Path(__file__).resolve().parents[1]
os.chdir(root)
# Launching this file directly adds scripts/, so explicitly expose the app package.
import sys
sys.path.insert(0, str(root))
port = int(os.environ.get('KHMER_STUDIO_PORT', '8765'))
url = f'http://127.0.0.1:{port}'

def open_browser():
    for _ in range(40):
        try:
            with urllib.request.urlopen(url + '/api/health', timeout=1) as response:
                if response.status == 200:
                    webbrowser.open(url)
                    return
        except Exception:
            time.sleep(.25)

if os.environ.get('KHMER_NO_BROWSER') != '1':
    threading.Thread(target=open_browser, daemon=True).start()
print(f'Khmer Voice Studio: {url}\nRecord your voice: {url}/record\nKeep this window open. Press Ctrl+C to stop.', flush=True)
uvicorn.run('local_tts.server:app', host='127.0.0.1', port=port, access_log=False)
