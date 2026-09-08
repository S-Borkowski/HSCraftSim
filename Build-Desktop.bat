@echo off
cd /d "%~dp0"
python tools\build-desktop.py
if errorlevel 1 (
  echo Build failed. Install requirements-build.txt and check the error above.
  pause
  exit /b 1
)
echo Windows release ready in the release folder.
pause
