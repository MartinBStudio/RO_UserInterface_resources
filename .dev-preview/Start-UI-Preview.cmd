@echo off
setlocal
title ROSE UI Workshop - close this window to stop
cd /d "%~dp0"
echo.
echo  ROSE UI Workshop - local development preview
echo.
echo  Keep this console window open while using the workshop.
echo  Close this window or press Ctrl+C to stop the preview server.
echo  Closing the browser tab alone does not stop the server.
echo.
echo  Quick start:
echo    1. Choose a theme and a UI window in the browser.
echo    2. Choose a resolution and UI scale to test your layout.
echo    3. Edit HTML, CSS, textures, or mock-data.json and save.
echo       Live reload updates the preview automatically.
echo.
echo  Full instructions: %~dp0README.md
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer, then run this file again.
  pause
  exit /b 1
)
if not exist node_modules\cheerio (
  call npm.cmd ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
rem Run in this console: do not use START or detach the server.
node server.mjs --open %*
echo.
echo  Preview server stopped.
if errorlevel 1 pause
