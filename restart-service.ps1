$ErrorActionPreference = 'Stop'
$appUrl = 'http://127.0.0.1:3210'
$statePath = Join-Path $PSScriptRoot '.runtime/server.json'
$localConfig = $null
try { $localConfig = Invoke-RestMethod "$appUrl/api/config" -TimeoutSec 3 } catch {}
if (Test-Path -LiteralPath $statePath) {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $appProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($state.pid)" -ErrorAction SilentlyContinue
    if ($appProcess) {
        $expectedServer = Join-Path $PSScriptRoot 'server.mjs'
        $stateWritten = (Get-Item -LiteralPath $statePath).LastWriteTime
        $sameStart = [Math]::Abs(($stateWritten - $appProcess.CreationDate).TotalSeconds) -lt 30
        $sameCommand = $appProcess.CommandLine.Contains($expectedServer) -or ($appProcess.CommandLine -match '(?i)(?:^|\s|")server\.mjs(?:\s|"|$)')
        if (-not ($sameStart -and $sameCommand -and $appProcess.Name -eq 'node.exe')) { throw 'Cannot verify app process identity; restart aborted.' }
        & taskkill.exe /PID $state.pid /F | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Unable to stop the verified local service process.' }
    }
}
$bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } elseif (Test-Path -LiteralPath $bundledNode) { $bundledNode } else { throw 'Node.js 22+ is required.' }
$serverPath = Join-Path $PSScriptRoot 'server.mjs'
$runtimeDir = Join-Path $PSScriptRoot '.runtime'
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
try {
    if ($localConfig.token) { $env:APP_SESSION_TOKEN = $localConfig.token }
    Start-Process -FilePath $nodePath -ArgumentList @(('"' + $serverPath + '"')) -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'server.log') -RedirectStandardError (Join-Path $runtimeDir 'error.log') | Out-Null
} finally { Remove-Item Env:APP_SESSION_TOKEN -ErrorAction SilentlyContinue }
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 300
    try {
        $ready = Invoke-RestMethod "$appUrl/api/config" -TimeoutSec 1
        if ($ready.providers.siliconflow) { Write-Host 'Local service restarted; existing pages can retry without refreshing.'; exit 0 }
    } catch {}
}
throw 'Restart failed. See .runtime/error.log.'
