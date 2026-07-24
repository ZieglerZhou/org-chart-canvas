@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

if not exist "electron-runtime\electron.exe" (
    echo [错误] 找不到 electron-runtime\electron.exe
    echo 请确保完整复制了整个文件夹
    pause
    exit /b 1
)

if not exist "dist\index.html" (
    echo [错误] 找不到 dist\index.html
    echo 请确保完整复制了整个文件夹
    pause
    exit /b 1
)

start "" "electron-runtime\electron.exe" "electron\main.cjs"

if %errorlevel% neq 0 (
    echo [错误] 应用启动失败，错误代码: %errorlevel%
    echo 可能缺少 Visual C++ 运行库，请安装 vcredist_x64.exe
    pause
)