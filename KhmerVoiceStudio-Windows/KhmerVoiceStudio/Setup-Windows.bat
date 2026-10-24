@echo off
cd /d "%~dp0"
py -3.12 --version >nul 2>&1
if not errorlevel 1 (
  py -3.12 scripts\setup-local.py
  goto done
)
py -3.11 --version >nul 2>&1
if not errorlevel 1 (
  py -3.11 scripts\setup-local.py
  goto done
)
python --version >nul 2>&1
if not errorlevel 1 (
  python scripts\setup-local.py
  goto done
)
echo Python 3.12 64-bit is needed. Install it with the Python launcher enabled.
echo https://www.python.org/downloads/windows/
:done
pause
