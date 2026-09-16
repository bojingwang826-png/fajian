@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist "data\server.pid" (
  echo 未找到后台服务记录，网站可能已经停止。
  pause
  exit /b
)

set /p SERVER_PID=<"data\server.pid"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Get-Process -Id %SERVER_PID% -ErrorAction SilentlyContinue; if($p -and $p.ProcessName -eq 'node'){ Stop-Process -Id %SERVER_PID% -Force; Write-Host '网站服务已停止。' } else { Write-Host '网站服务已经停止。' }"
del /q "data\server.pid" >nul 2>nul
pause
