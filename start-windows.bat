@echo off
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22+ gerekli.
  pause
  exit /b 1
)
echo Rootcastle Poker baslatiliyor...
echo Tarayicida ac: http://127.0.0.1:8787
node dist\server.js
