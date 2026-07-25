@echo off
setlocal

where node >nul 2>nul
if errorlevel 1 (
  echo [nowledge-mem] WorkBuddy's managed Node runtime is unavailable 1>&2
  exit /b 127
)

node %*
