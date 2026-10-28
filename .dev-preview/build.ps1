$ErrorActionPreference = 'Stop'
$previewDir = $PSScriptRoot
$sdkDir = Join-Path $previewDir '.cache/emsdk'
$rmlDir = Join-Path $previewDir '.cache/RmlUi'

function Run-Checked([string]$program, [string[]]$arguments) {
    & $program @arguments
    if ($LASTEXITCODE -ne 0) { throw "$program failed with exit code $LASTEXITCODE" }
}

if (!(Test-Path "$sdkDir/upstream/emscripten/emcc.bat")) {
    New-Item -ItemType Directory -Force "$previewDir/.cache" | Out-Null
    if (!(Test-Path "$sdkDir/emsdk.py")) { Run-Checked 'git' @('clone', '--depth', '1', 'https://github.com/emscripten-core/emsdk.git', $sdkDir) }
    # Bootstrap Python stays outside the SDK so installation can replace SDK Python.
    $bootstrapPython = "$previewDir/.cache/bootstrap-python/python.exe"
    if (!(Test-Path $bootstrapPython)) {
        Invoke-WebRequest 'https://www.python.org/ftp/python/3.13.3/python-3.13.3-embed-amd64.zip' -OutFile "$previewDir/.cache/python.zip"
        Expand-Archive "$previewDir/.cache/python.zip" "$previewDir/.cache/bootstrap-python" -Force
    }
    Run-Checked $bootstrapPython @("$sdkDir/emsdk.py", 'install', '4.0.23')
}
if (!(Test-Path "$rmlDir/CMakeLists.txt")) { Run-Checked 'git' @('clone', '--depth', '1', '--branch', '6.1', 'https://github.com/mikke89/RmlUi.git', $rmlDir) }
$pythonDir = "$sdkDir/python/3.13.3_64bit"
Run-Checked "$pythonDir/python.exe" @("$sdkDir/emsdk.py", 'activate', '4.0.23')
$cmakeCommand = Get-Command cmake -ErrorAction SilentlyContinue
$ninjaCommand = Get-Command ninja -ErrorAction SilentlyContinue
if ($cmakeCommand) { $cmakePath = Split-Path $cmakeCommand.Source }
else {
    $cmakeExe = Get-ChildItem 'C:/Program Files/Microsoft Visual Studio/*/*/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe' | Select-Object -First 1
    if (!$cmakeExe) { throw 'Install CMake and Ninja, or Visual Studio with C++ CMake tools.' }
    $cmakePath = $cmakeExe.DirectoryName
}
if ($ninjaCommand) { $ninjaPath = Split-Path $ninjaCommand.Source }
else {
    $ninjaExe = Get-ChildItem 'C:/Program Files/Microsoft Visual Studio/*/*/Common7/IDE/CommonExtensions/Microsoft/CMake/Ninja/ninja.exe' | Select-Object -First 1
    if (!$ninjaExe) { throw 'Install Ninja and add it to PATH.' }
    $ninjaPath = $ninjaExe.DirectoryName
}
$sdkNodeDir = Get-ChildItem "$sdkDir/node" -Directory | Select-Object -First 1
$env:PATH = "$pythonDir;$($sdkNodeDir.FullName)/bin;$($sdkNodeDir.FullName);$sdkDir/upstream/emscripten;$cmakePath;$ninjaPath;$env:PATH"
$env:EMSDK = $sdkDir
$env:EMSDK_PYTHON = "$pythonDir/python.exe"
$env:EM_CONFIG = "$sdkDir/.emscripten"
Run-Checked "$sdkDir/upstream/emscripten/emcmake.bat" @('cmake', '-S', "$previewDir/renderer", '-B', "$previewDir/.cache/wasm-build", '-G', 'Ninja', '-DCMAKE_BUILD_TYPE=Release')
Run-Checked 'cmake' @('--build', "$previewDir/.cache/wasm-build", '--parallel', '8')
Write-Host 'Renderer ready. Run Start-UI-Preview.cmd.'
