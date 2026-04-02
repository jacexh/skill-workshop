: << 'CMDBLOCK'
@echo off
setlocal enabledelayedexpansion

set "HOOK_NAME=%~1"
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

REM Try Git for Windows bash first
where bash >nul 2>nul
if %errorlevel% equ 0 (
    bash "%SCRIPT_DIR%/%HOOK_NAME%" %*
    exit /b %errorlevel%
)

REM Try common bash locations
for %%B in (
    "C:\Program Files\Git\bin\bash.exe"
    "C:\Program Files (x86)\Git\bin\bash.exe"
    "%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
    "C:\msys64\usr\bin\bash.exe"
    "C:\cygwin64\bin\bash.exe"
) do (
    if exist %%B (
        %%B "%SCRIPT_DIR%/%HOOK_NAME%" %*
        exit /b %errorlevel%
    )
)

echo {"error": "bash not found. Install Git for Windows or WSL."} >&2
exit /b 1
CMDBLOCK

#!/usr/bin/env bash
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_NAME="$1"
shift

exec "$SCRIPT_DIR/$HOOK_NAME" "$@"
