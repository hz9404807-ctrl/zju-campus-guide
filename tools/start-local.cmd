@echo off
setlocal
set "PREVIEW_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%PREVIEW_NODE%" (
  "%PREVIEW_NODE%" "%~dp0start-local.mjs"
) else (
  node "%~dp0start-local.mjs"
)
if errorlevel 1 pause
