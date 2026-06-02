@echo off
pushd "%~dp0"
title English Learning Assistant

echo ============================================
echo   English Learning Assistant
echo   Education PhD Prep
echo ============================================
echo.

echo [1/3] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Python 3 not found.
    echo Please install Python from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo [2/3] Installing dependencies...
pip install -r requirements.txt --quiet 2>nul

echo [3/3] Starting app...
echo.
echo   DO NOT close this window while using the app.
echo   Press Ctrl+C to quit when done.
echo.
echo ============================================

python server.py

echo.
echo App stopped.
pause
