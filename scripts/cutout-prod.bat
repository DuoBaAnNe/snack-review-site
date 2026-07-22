@echo off
cd /d "%~dp0.."
echo ============================================
echo  Snack image cutout - LIVE database
echo  (run AFTER the local test looks good and
echo   the site has been deployed)
echo ============================================
echo.
rem sharp MUST be pinned to 0.32.x -- @imgly/background-removal-node needs it,
rem and a newer sharp crashes with ERR_DLOPEN_FAILED on this machine.
call npm install --no-save @imgly/background-removal-node sharp@0.32.6
node scripts/cutout.js --prod
echo.
echo DONE. Hard-refresh linglingqi.fun to see it live.
pause
