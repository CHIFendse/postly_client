# Запускать из корня проекта: powershell -File build\windows\build-installer.ps1
$ErrorActionPreference = 'Stop'

$root   = (Get-Location).Path
$binary = Join-Path $root 'build\bin\postly.exe'
$nsiDir = Join-Path $root 'build\windows\nsis'

Write-Host "Binary : $binary"
Write-Host "NSI dir: $nsiDir"

Push-Location $nsiDir
try {
    & makensis "/DARG_WAILS_AMD64_BINARY=$binary" project.nsi
} finally {
    Pop-Location
}
