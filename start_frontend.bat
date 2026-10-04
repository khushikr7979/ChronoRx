@echo off
setlocal
echo ===================================================
echo   Starting ChronoRx Tech Frontend Application
echo ===================================================

rem Ensure Node and npm paths are included in PATH
set PATH=C:\Users\Khushi\AppData\Local\Programs\nodejs;%PATH%

cd /d "%~dp0frontend"
echo Launching Vite development server on http://localhost:5173...
call npm run dev
if errorlevel 1 (
    echo npm not found on standard PATH, trying direct path...
    call "C:\Users\Khushi\AppData\Local\Programs\nodejs\npm.cmd" run dev
)
pause
