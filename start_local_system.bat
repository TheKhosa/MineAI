@echo off
echo ========================================
echo MineRL Local System Startup
echo ========================================
echo.
echo This will start:
echo 1. Minecraft Server Manager (downloads plugin from TeamCity)
echo 2. Local Spigot Server (D:\MCServer\Server)
echo 3. AI Agents (connects to localhost)
echo.
echo Press Ctrl+C to stop everything
echo ========================================
echo.

REM Start the server manager
echo Starting Minecraft Server Manager...
node minecraft_server_manager.js

echo.
echo System shutdown.
pause
