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
echo    4. Or use the code pane: preview as you type, Ctrl+S to save.
echo.
echo  Full instructions: %~dp0README.md
echo.
where node >nul 2>nul
if errorlevel 1 (
  set "nodeProblem=Node.js was not found on PATH."
  goto node_required
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)" >nul 2>nul
if errorlevel 1 (
  set "nodeProblem=Node.js 22 or newer is required. The installed version is too old or cannot run."
  goto node_required
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  set "nodeProblem=npm was not found. Reinstall Node.js with npm included."
  goto node_required
)
echo  Node.js detected:
node --version
echo.
if not exist node_modules\cheerio (
  call npm.cmd ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
rem Run in this console: do not use START or detach the server.
node server.mjs --open %*
set "previewExitCode=%errorlevel%"
echo.
echo  Preview server stopped.
if not "%previewExitCode%"=="0" pause
exit /b %previewExitCode%

:node_required
echo.
echo  Cannot start ROSE UI Workshop.
echo  %nodeProblem%
echo.
echo  Please install Node.js 22 or newer first:
echo    https://nodejs.org/
echo.
echo  Include npm and enable the installer option to add Node.js to PATH.
echo  After installation, close this window and run Start-UI-Preview.cmd again.
echo.
pause
exit /b 1
