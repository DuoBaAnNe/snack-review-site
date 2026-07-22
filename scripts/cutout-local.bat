@echo off
cd /d "%~dp0.."
echo ============================================
echo  Snack image cutout - LOCAL database
echo ============================================
echo.
echo [1/2] Installing AI tools (first run downloads ~80MB, please wait)...
rem sharp MUST be pinned to 0.32.x (newer sharp crashes with ERR_DLOPEN_FAILED)
call npm install --no-save @imgly/background-removal-node sharp@0.32.6
echo.
echo [2/2] Removing backgrounds (a few seconds per image)...
node scripts/cutout.js
echo.
echo DONE. Refresh localhost:3000 and hover a snack card.
pause
