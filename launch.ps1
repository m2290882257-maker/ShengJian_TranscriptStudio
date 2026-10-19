$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } elseif (Test-Path -LiteralPath $bundledNode) { $bundledNode } else { throw 'Please install Node.js 22 or newer.' }
$appUrl = 'http://127.0.0.1:3210'
$serviceReady = $false
try { $check = Invoke-RestMethod "$appUrl/api/config" -TimeoutSec 2; $serviceReady = [bool]$check.providers.siliconflow } catch {}
if (-not $serviceReady) {
    $runtimeDir = Join-Path $projectRoot '.runtime'
    New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
    $serverPath = Join-Path $projectRoot 'server.mjs'
    Start-Process -FilePath $nodePath -ArgumentList @(('"' + $serverPath + '"')) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'server.log') -RedirectStandardError (Join-Path $runtimeDir 'error.log') | Out-Null
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 300
        try { $check = Invoke-RestMethod "$appUrl/api/config" -TimeoutSec 1; if ($check.providers.siliconflow) { $serviceReady = $true; break } } catch {}
    }
}
if (-not $serviceReady) { throw 'Cannot start app. Check .runtime/error.log or port 3210.' }
$browserPaths = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
)
$browserPath = $browserPaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if ($browserPath) { Start-Process -FilePath $browserPath -ArgumentList "--app=$appUrl" } else { Start-Process $appUrl }
