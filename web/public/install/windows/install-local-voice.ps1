param(
    [string]$Distro = "Ubuntu",
    [string]$WslProjectPath
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    throw "WSL is not available. Install and launch an Ubuntu WSL2 distribution first, then run this script again. This script does not install or reset WSL."
}

if ([string]::IsNullOrWhiteSpace($WslProjectPath)) {
    $WindowsProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
    $WslPathOutput = & wsl.exe -d $Distro --exec wslpath -a $WindowsProjectPath
    if ($LASTEXITCODE -ne 0) {
        throw "Could not find WSL distribution '$Distro' or translate the project path. Start the distribution once and retry."
    }
    $WslProjectPath = ($WslPathOutput | Out-String).Trim()
}

if (-not $WslProjectPath.StartsWith("/")) {
    throw "WslProjectPath must be an absolute Linux path such as /home/user/recording-voice."
}

Write-Host "Installing the local Voice Studio runtime in WSL distribution '$Distro'."
Write-Host "Project path: $WslProjectPath"
& wsl.exe -d $Distro --exec bash -lc 'cd -- "$1" && test -f scripts/install-linux.sh && ./scripts/install-linux.sh' voice-studio $WslProjectPath
if ($LASTEXITCODE -ne 0) {
    throw "Linux runtime installation failed with exit code $LASTEXITCODE. Review the WSL output above."
}

Write-Host "Installation checks passed. Start it with scripts/windows/start-local-voice.ps1."
