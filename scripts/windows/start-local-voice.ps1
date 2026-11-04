param(
    [Parameter(Mandatory = $true)]
    [string]$InstallRoot,
    [string]$AllowedOrigin = "https://recording-voice-web.vercel.app"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$AppData = Join-Path $env:LOCALAPPDATA "VoiceStudio"
$DataDir = Join-Path $AppData "data"
$ModelCache = Join-Path $AppData "models\huggingface"
$LogsDir = Join-Path $AppData "logs"
$StdoutLog = Join-Path $LogsDir "backend-out.log"
$StderrLog = Join-Path $LogsDir "backend-error.log"
$Python = Join-Path $InstallRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $Python)) { throw "Voice Studio is not installed. Run the Windows installer first." }
New-Item -ItemType Directory -Force -Path $DataDir, $ModelCache, $LogsDir | Out-Null
foreach ($log in @($StdoutLog, $StderrLog)) {
    if ((Test-Path $log) -and (Get-Item $log).Length -gt 5MB) {
        Move-Item -Force $log "$log.1"
    }
}

$env:LOCAL_VOICE_DATA_DIR = $DataDir
$env:HF_HOME = $ModelCache
$env:LOCAL_VOICE_ALLOWED_ORIGINS = $AllowedOrigin
$env:LOCAL_VOICE_AUTO_PAIR = "1"
$env:LOCAL_VOICE_PORT = "8765"

try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8765/api/v1/health" -TimeoutSec 2
    if ($health.status -eq "ok") { exit 0 }
} catch { }

$process = Start-Process -FilePath $Python -ArgumentList @("-m", "local_runtime.app") `
    -WorkingDirectory $InstallRoot -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $StdoutLog -RedirectStandardError $StderrLog
Set-Content -Path (Join-Path $AppData "backend.pid") -Value $process.Id -Encoding ascii
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Seconds 1
    if ($process.HasExited) { throw "The local backend stopped during startup. Check $StderrLog." }
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:8765/api/v1/health" -TimeoutSec 2
        if ($health.status -eq "ok") { exit 0 }
    } catch { }
}
throw "The local backend did not become ready. Check $StderrLog."
