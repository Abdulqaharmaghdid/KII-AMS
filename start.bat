@echo off
cd /d "%~dp0"
echo.
echo  ============================================
echo   KII Application Management System
echo   (local server - shared database in .\data)
echo  ============================================
echo.
echo   Applicant portal:   http://localhost:8090/index.html
echo   Staff portal:       http://localhost:8090/admin-login.html
echo   Other devices on your Wi-Fi/network: use the "On your network" address below.
echo.
echo   Keep this window open while using the system. Press Ctrl+C to stop.
echo  ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js is required. Install the LTS version from https://nodejs.org and run start.bat again.
  pause
  exit /b 1
)

REM open the applicant portal in the browser once the server is ready
start "" powershell -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:8090/index.html'"

node server\server.cjs
pause
