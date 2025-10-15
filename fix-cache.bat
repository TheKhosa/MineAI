@echo off
echo ========================================
echo HuggingFace Cache Fix Script
echo ========================================
echo.

echo Step 1: Killing all Node.js processes...
taskkill /F /IM node.exe /T >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Node.js processes terminated
) else (
    echo   [INFO] No Node.js processes were running
)

echo.
echo Step 2: Waiting for file handles to release...
timeout /t 2 /nobreak >nul

echo.
echo Step 3: Deleting cache...
set CACHE_DIR=node_modules\@huggingface\transformers\.cache\onnx-community\Qwen2.5-Coder-1.5B-Instruct

if exist "%CACHE_DIR%" (
    rmdir /s /q "%CACHE_DIR%" 2>nul
    if exist "%CACHE_DIR%" (
        echo   [WARN] Could not delete cache, trying PowerShell...
        powershell -Command "Remove-Item -Path '%CACHE_DIR%' -Recurse -Force" 2>nul
    )

    if not exist "%CACHE_DIR%" (
        echo   [OK] Cache deleted successfully
    ) else (
        echo   [ERROR] Cache still exists - may need manual deletion
        echo   Location: %CD%\%CACHE_DIR%
    )
) else (
    echo   [INFO] Cache directory not found
)

echo.
echo Step 4: Checking for old corrupted caches...
set CACHE_BASE=node_modules\@huggingface\transformers\.cache\onnx-community
for /d %%i in ("%CACHE_BASE%\*_corrupted_*") do (
    echo   Found corrupted cache: %%~nxi
    rmdir /s /q "%%i" 2>nul
)

for /d %%i in ("%CACHE_BASE%\*_cleared_*") do (
    echo   Found old cleared cache: %%~nxi
    rmdir /s /q "%%i" 2>nul
)

echo.
echo ========================================
echo Done! You can now run: node server.js
echo ========================================
pause
