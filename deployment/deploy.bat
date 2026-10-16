@echo off
setlocal DisableDelayedExpansion
pwsh.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-local.ps1" -AppDockDirectory "%~1"
exit /b %errorlevel%
