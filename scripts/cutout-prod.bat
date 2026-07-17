@echo off
cd /d "%~dp0.."
echo ============================================
echo  Snack image cutout - LIVE database
echo  (run AFTER the local test looks good and
echo   the site has been deployed)
echo ============================================
echo.
call npm install --no-save @imgly/background-removal-node sharp
node scripts/cutout.js --prod
echo.
echo DONE. Hard-refresh linglingqi.fun to see it live.
pause
