param(
    [Parameter(Mandatory = $true)]
    [string]$InstallRoot,
    [string]$AllowedOrigin = "https://recording-voice-web.vercel.app"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

$AppData = Join-Path $env:LOCALAPPDATA "VoiceStudio"
$DataDir = Join-Path $AppData "data"
$ModelCache = Join-Path $AppData "models"
$LogsDir = Join-Path $AppData "logs"
$RuntimeDir = Join-Path $InstallRoot "python"
$ManagerMsix = Join-Path $env:TEMP "VoiceStudio-PythonInstallManager-26.0.msix"
$ManagerMsixUrl = "https://www.python.org/ftp/python/pymanager/python-manager-26.0.msix"

if (-not [Environment]::Is64BitOperatingSystem) { throw "Voice Studio requires 64-bit Windows 10 or 11." }
$OriginUri = $null
if (-not [Uri]::TryCreate($AllowedOrigin, [UriKind]::Absolute, [ref]$OriginUri) -or
    $OriginUri.Scheme -notin @("http", "https") -or $OriginUri.AbsolutePath -ne "/" -or
    $OriginUri.Query -or $OriginUri.Fragment) {
    throw "AllowedOrigin must be one exact http(s) origin."
}

New-Item -ItemType Directory -Force -Path $AppData, $DataDir, $ModelCache, $LogsDir, $RuntimeDir | Out-Null
$env:LOCAL_VOICE_DATA_DIR = $DataDir
$env:HF_HOME = Join-Path $ModelCache "huggingface"
$env:LOCAL_VOICE_ALLOWED_ORIGINS = $AllowedOrigin
$env:LOCAL_VOICE_AUTO_PAIR = "1"

$PidFile = Join-Path $AppData "backend.pid"
if (Test-Path $PidFile) {
    $backendId = 0
    if ([int]::TryParse((Get-Content -Raw $PidFile).Trim(), [ref]$backendId)) {
        $backend = Get-Process -Id $backendId -ErrorAction SilentlyContinue
        if ($backend -and $backend.Path -and [IO.Path]::GetFullPath($backend.Path).StartsWith([IO.Path]::GetFullPath($InstallRoot).TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
            Stop-Process -Id $backendId -Force
            Wait-Process -Id $backendId -Timeout 10 -ErrorAction SilentlyContinue
        }
    }
    Remove-Item -Force $PidFile -ErrorAction SilentlyContinue
}

Write-Step "Downloading the private Python runtime"
if (-not (Test-Path (Join-Path $RuntimeDir "python.exe"))) {
    $managerPackageName = "PythonSoftwareFoundation.PythonManager"
    $managerWasInstalled = @((Get-AppxPackage -Name $managerPackageName -ErrorAction SilentlyContinue)).Count -gt 0
    if (-not $managerWasInstalled) {
        Invoke-WebRequest -Uri $ManagerMsixUrl -OutFile $ManagerMsix
        Add-AppxPackage -Path $ManagerMsix
    }
    try {
        $manager = Get-Command pymanager -ErrorAction Stop
        & $manager.Source install "--target=$RuntimeDir" "3.12"
        if ($LASTEXITCODE -ne 0) { throw "Python Install Manager could not install Python 3.12." }
    } finally {
        if (-not $managerWasInstalled) {
            Get-AppxPackage -Name $managerPackageName -ErrorAction SilentlyContinue | Remove-AppxPackage -ErrorAction SilentlyContinue
        }
        Remove-Item -Force $ManagerMsix -ErrorAction SilentlyContinue
    }
}
$Python = Join-Path $RuntimeDir "python.exe"
if (-not (Test-Path $Python)) { throw "The private Python runtime was not installed." }

Write-Step "Preparing Voice Studio and CPU inference dependencies"
$Venv = Join-Path $InstallRoot ".venv"
if (-not (Test-Path (Join-Path $Venv "Scripts\python.exe"))) {
    & $Python -m venv $Venv
    if ($LASTEXITCODE -ne 0) { throw "Could not create the Voice Studio environment." }
}
$VenvPython = Join-Path $Venv "Scripts\python.exe"
& $VenvPython -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "Could not prepare pip." }
& $VenvPython -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
if ($LASTEXITCODE -ne 0) { throw "Could not install the CPU inference runtime." }
& $VenvPython -m pip install -r (Join-Path $InstallRoot "requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "Could not install the Voice Studio dependencies." }
& $VenvPython -m pip install --no-deps --force-reinstall (Join-Path $InstallRoot "local_runtime")
if ($LASTEXITCODE -ne 0) { throw "Could not install the Voice Studio backend." }
& $VenvPython -m pip check
if ($LASTEXITCODE -ne 0) { throw "Voice Studio dependency validation failed." }

Write-Step "Starting the local backend"
$Launcher = Join-Path $InstallRoot "scripts\windows\start-local-voice.ps1"
& $Launcher -InstallRoot $InstallRoot -AllowedOrigin $AllowedOrigin
