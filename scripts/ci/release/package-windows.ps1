# package-windows.ps1
# Package built Windows binaries into a zip archive with SHA256 checksum.
#
# Usage:
#   $env:VERSION = "0.1.0"
#   $env:TARGET = "x86_64-pc-windows-msvc"
#   .\scripts\ci\release\package-windows.ps1

param(
    [string]$Version = $env:VERSION,
    [string]$Target = $env:TARGET
)

if (-not $Version -or -not $Target) {
    Write-Error "VERSION and TARGET are required"
    exit 1
}

$Staging = "rustume-${Version}-${Target}"
New-Item -ItemType Directory -Path $Staging -Force | Out-Null

$Cli = "target/${Target}/release/rustume.exe"
$Srv = "target/${Target}/release/rustume-server.exe"

Copy-Item $Cli "$Staging/" -ErrorAction SilentlyContinue
Copy-Item $Srv "$Staging/" -ErrorAction SilentlyContinue
Copy-Item "README.md", "LICENSE" "$Staging/" -ErrorAction SilentlyContinue

Compress-Archive -Path "$Staging" -DestinationPath "${Staging}.zip"
$Hash = Get-FileHash "${Staging}.zip" -Algorithm SHA256
$Hash | Format-List | Out-File "${Staging}.zip.sha256"

Write-Output "Packaged ${Staging}.zip"
