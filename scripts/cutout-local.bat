@echo off
cd /d "%~dp0.."
echo ============================================
echo  Snack image cutout - LOCAL database
echo ============================================
echo.
echo [1/2] Installing AI tools (first run downloads ~80MB, please wait)...
call npm install --no-save @imgly/background-removal-node sharp
echo.
echo [2/2] Removing backgrounds (a few seconds per image)...
node scripts/cutout.js
echo.
echo DONE. Refresh localhost:3000 and hover a snack card.
pause
