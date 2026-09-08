@echo off
cd /d "%~dp0"
call npm run verify
if errorlevel 1 (
  echo.
  echo Build or verification failed. See the error above.
  pause
  exit /b 1
)
echo.
echo Website ready in the dist folder. Upload its contents to your static host.
pause
