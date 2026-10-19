param([switch]$Desktop)
$ErrorActionPreference = 'Stop'
$destination = if ($Desktop) { [Environment]::GetFolderPath('Desktop') } else { $PSScriptRoot }
$shortcutName = ([string][char]0x58F0) + ([string][char]0x7B3A) + '.lnk'
$shortcutPath = Join-Path $destination $shortcutName
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $PSScriptRoot 'open-app.ps1') + '"'
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.IconLocation = (Join-Path $PSScriptRoot 'assets\shengjian.ico') + ',0'
$shortcut.Description = 'Transcript Studio - local audio transcription workspace'
$shortcut.WindowStyle = 7
$shortcut.Save()
Write-Host ('Created shortcut: ' + $shortcutPath)
