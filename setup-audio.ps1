$ErrorActionPreference = 'Stop'
$bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$targetDir = Join-Path $PSScriptRoot 'tools/python'
if (Test-Path -LiteralPath $bundledPython) {
    & $bundledPython -m pip install --target $targetDir imageio-ffmpeg==0.6.0 --disable-pip-version-check
} else {
    py -3 -m pip install --target $targetDir imageio-ffmpeg==0.6.0 --disable-pip-version-check
}
if ($LASTEXITCODE -ne 0) { throw 'Audio dependency installation failed.' }
