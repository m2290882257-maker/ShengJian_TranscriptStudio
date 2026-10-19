$ErrorActionPreference = 'Stop'
$statePath = Join-Path $PSScriptRoot '.runtime/server.json'
if (Test-Path -LiteralPath $statePath) {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $appProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($state.pid)" -ErrorAction SilentlyContinue
    $expectedServer = Join-Path $PSScriptRoot 'server.mjs'
    $stateWritten = (Get-Item -LiteralPath $statePath).LastWriteTime
    $sameStart = $appProcess -and ([Math]::Abs(($stateWritten - $appProcess.CreationDate).TotalSeconds) -lt 30)
    $sameCommand = $appProcess -and ($appProcess.CommandLine.Contains($expectedServer) -or ($appProcess.CommandLine -match '(?i)(?:^|\s|")server\.mjs(?:\s|"|$)'))
    if ($sameStart -and $sameCommand -and $appProcess.Name -eq 'node.exe') {
        & taskkill.exe /PID $state.pid /F | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Unable to stop the verified local service process.' }
        Write-Host 'App server stopped.'
    }
}
