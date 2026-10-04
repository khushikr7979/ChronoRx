@echo off
setlocal
echo ===================================================
echo   Starting ChronoRx Tech Backend API Server
echo ===================================================

rem Ensure Python and Node paths are included in PATH
set PATH=C:\Users\Khushi\AppData\Local\Programs\Python\Python313;C:\Users\Khushi\AppData\Local\Programs\Python\Python313\Scripts;%PATH%

cd /d "%~dp0backend"
echo Launching FastAPI server on http://127.0.0.1:8000...
python run.py
if errorlevel 1 (
    echo Python not found on standard PATH, trying direct path...
    "C:\Users\Khushi\AppData\Local\Programs\Python\Python313\python.exe" run.py
)
pause
