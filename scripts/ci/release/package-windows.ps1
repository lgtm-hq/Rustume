# package-windows.ps1
# Package built Windows binaries into a zip archive with SHA256 checksum.
# Fails if required binaries are missing.
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

$Cli = "target/${Target}/release/rustume.exe"
$Srv = "target/${Target}/release/rustume-server.exe"

# Verify required binaries exist
$Missing = 0
foreach ($Bin in @($Cli, $Srv)) {
    if (-not (Test-Path $Bin)) {
        Write-Error "Required binary not found: $Bin"
        $Missing++
    }
}
if ($Missing -gt 0) {
    Write-Error "Aborting: $Missing required binary/binaries missing"
    exit 1
}

$Staging = "rustume-${Version}-${Target}"
New-Item -ItemType Directory -Path $Staging -Force | Out-Null

Copy-Item $Cli "$Staging/"
Copy-Item $Srv "$Staging/"
Copy-Item "README.md", "LICENSE" "$Staging/" -ErrorAction SilentlyContinue

Compress-Archive -Path "$Staging" -DestinationPath "${Staging}.zip"
$Hash = Get-FileHash "${Staging}.zip" -Algorithm SHA256
$Hash | Format-List | Out-File "${Staging}.zip.sha256"

Write-Output "Packaged ${Staging}.zip"
