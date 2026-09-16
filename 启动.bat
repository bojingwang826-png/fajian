@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem 后台启动本地服务；启动窗口关闭后网站仍可使用。
powershell -NoProfile -ExecutionPolicy Bypass -Command "$l=Get-NetTCPConnection -LocalPort 3737 -State Listen -ErrorAction SilentlyContinue; if(-not $l){ $env:NO_OPEN_BROWSER='1'; $p=Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -RedirectStandardOutput 'data\server.log' -RedirectStandardError 'data\server-error.log' -PassThru; $p.Id | Set-Content -Encoding ascii 'data\server.pid'; Start-Sleep -Milliseconds 1200 }"

start "" "http://localhost:3737"
exit /b
