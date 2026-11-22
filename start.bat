@echo off
title AeroCare Maintenance System Launcher
echo ========================================================
echo       AeroCare AI Aircraft Maintenance Platform
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Starting FastAPI Backend on port 8000...
start "AeroCare Backend (Port 8000)" cmd /k "cd backend && python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] Starting React Vite Frontend on port 3000...
start "AeroCare Frontend (Port 3000)" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo AeroCare Maintenance Website is now running!
echo Opening browser to http://localhost:3000 ...
echo ========================================================
timeout /t 3 >nul
start http://localhost:3000

