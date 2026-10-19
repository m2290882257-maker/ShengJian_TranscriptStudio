$ErrorActionPreference = 'Stop'
try {
    & (Join-Path $PSScriptRoot 'launch.ps1')
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Transcript Studio - startup error', 'OK', 'Error') | Out-Null
    exit 1
}
