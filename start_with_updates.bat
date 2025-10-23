@echo off
echo ============================================================
echo MINECRAFT SERVER - STARTUP WITH AUTO-UPDATES
echo ============================================================
echo.

echo [1/3] Checking for plugin updates...
node plugin_updater.js
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Plugin update check failed, continuing anyway...
)
echo.

echo [2/3] Starting Minecraft server...
cd /d D:\MCServer\Server
start "Minecraft Server" cmd /k "java -Xmx4G -Xms2G -jar server.jar nogui"
echo Minecraft server started in new window
echo.

echo [3/3] Starting Node.js agent system...
cd /d D:\MineRL
timeout /t 30 /nobreak >nul
echo Waiting for Minecraft server to be ready...
node server.js

echo.
echo ============================================================
echo ALL SYSTEMS STARTED
echo ============================================================
pause
