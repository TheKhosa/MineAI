@echo off
echo Starting Intelligent Village System...
echo.

REM Start the main intelligent village server
echo Starting main server (intelligent_village.js)...
start "Intelligent Village Server" cmd /k "node intelligent_village.js"

REM Wait a moment for the server to initialize
timeout /t 3 /nobreak >nul

REM Start the dashboard
echo Starting dashboard server (dashboard.js)...
start "Dashboard Server" cmd /k "node dashboard.js"

echo.
echo ========================================
echo Intelligent Village system is starting!
echo ========================================
echo Main Server: Running in separate window
echo Dashboard: http://localhost:3000
echo.
echo Press any key to exit this window...
pause >nul
