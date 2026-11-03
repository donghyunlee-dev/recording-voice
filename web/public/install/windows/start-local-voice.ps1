param(
    [string]$Distro = "Ubuntu",
    [string]$WslProjectPath,
    [string]$AllowedOrigin = "http://localhost:5173"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    throw "WSL is not available. Install and launch an Ubuntu WSL2 distribution first."
}

$OriginUri = $null
if (-not [Uri]::TryCreate($AllowedOrigin, [UriKind]::Absolute, [ref]$OriginUri) -or
    $OriginUri.Scheme -notin @("http", "https") -or
    $OriginUri.AbsolutePath -ne "/" -or $OriginUri.Query -or $OriginUri.Fragment -or
    $AllowedOrigin -eq "*") {
    throw "AllowedOrigin must be one exact http(s) origin, for example https://your-site.vercel.app."
}

if ([string]::IsNullOrWhiteSpace($WslProjectPath)) {
    $WindowsProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
    $WslPathOutput = & wsl.exe -d $Distro --exec wslpath -a $WindowsProjectPath
    if ($LASTEXITCODE -ne 0) {
        throw "Could not find WSL distribution '$Distro' or translate the project path."
    }
    $WslProjectPath = ($WslPathOutput | Out-String).Trim()
}

if (-not $WslProjectPath.StartsWith("/")) {
    throw "WslProjectPath must be an absolute Linux path such as /home/user/recording-voice."
}

Write-Host "Starting the local runtime on 127.0.0.1:8765. Keep this window open."
Write-Host "Allowed web origin: $AllowedOrigin"
& wsl.exe -d $Distro --exec env "LOCAL_VOICE_ALLOWED_ORIGINS=$AllowedOrigin" bash -lc 'cd -- "$1" && test -f scripts/start-local-runtime-linux.sh && ./scripts/start-local-runtime-linux.sh' voice-studio $WslProjectPath
if ($LASTEXITCODE -ne 0) {
    throw "The local runtime exited with code $LASTEXITCODE. Review the WSL output above."
}
