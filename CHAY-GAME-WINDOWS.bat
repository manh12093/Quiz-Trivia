@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Ban chua cai Node.js. Trang tai se mo ra: hay tai ban LTS, cai dat, roi bam dup lai file nay.
  start https://nodejs.org
  pause
  exit /b
)
start "May chu game - dung dong cua so nay khi dang choi" cmd /k node server.js
timeout /t 2 >nul
start http://localhost:3000
echo.
echo ===== Dang tao LINK CHO THI SINH =====
echo Cho vai giay, tim dong co chu "trycloudflare.com" ben duoi, gui link do cho thi sinh.
echo Dung dong cua so nay trong suot buoi choi.
echo.
npx --yes cloudflared tunnel --url http://localhost:3000
pause
