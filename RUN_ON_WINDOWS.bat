@echo off
setlocal
cd /d "%~dp0"
echo ReLoop prototype setup
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js LTS from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing project dependencies. This requires an internet connection the first time...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed. Check your internet connection and Node.js installation.
    pause
    exit /b 1
  )
)
echo Starting ReLoop. Keep this window open while using the app.
call npm run dev
pause
