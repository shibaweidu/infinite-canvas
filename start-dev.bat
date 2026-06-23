@echo off
title infinite-canvas dev launcher

echo ========================================
echo   Starting infinite-canvas dev servers
echo ========================================
echo.

REM Backend Go service (port 8080)
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %ERRORLEVEL% EQU 0 (
    echo Backend port 8080 is already in use, skip starting backend.
) else (
    start "ic-backend" cmd /k "cd /d %~dp0 && set PATH=%PATH%;C:\Program Files\Go\bin&& go run ."
)

REM Frontend Next.js service (port 3002)
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort 3002 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %ERRORLEVEL% EQU 0 (
    echo Frontend port 3002 is already in use, skip starting frontend.
) else (
    start "ic-frontend" cmd /k "cd /d %~dp0web && bun run dev"
)

echo.
echo Dev server status:
echo   ic-backend  : backend  http://127.0.0.1:8080
echo   ic-frontend : frontend http://localhost:3002
echo.
echo When the frontend window shows "Ready", open http://localhost:3002
echo Close a window to stop that service.
echo.
pause
