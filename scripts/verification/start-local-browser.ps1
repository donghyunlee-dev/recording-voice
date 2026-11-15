$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$appRoot = Join-Path $env:LOCALAPPDATA 'Programs\VoiceStudio'
$dataRoot = Join-Path $env:LOCALAPPDATA 'VoiceStudio\data'
$logsRoot = Join-Path $env:LOCALAPPDATA 'VoiceStudio\logs'
$pidFile = Join-Path $env:LOCALAPPDATA 'VoiceStudio\backend.pid'
$runtimePython = Join-Path $appRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $runtimePython)) { throw 'Installed Voice Studio runtime is missing.' }
if (Test-Path $pidFile) {
    $oldPid = 0
    if ([int]::TryParse((Get-Content -Raw $pidFile).Trim(), [ref]$oldPid)) {
        $old = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
        $rootPrefix = [IO.Path]::GetFullPath($appRoot).TrimEnd('\') + '\'
        if ($old -and $old.Path -and [IO.Path]::GetFullPath($old.Path).StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            Stop-Process -Id $oldPid -Force
            Start-Sleep -Seconds 1
        }
    }
}
try {
    Invoke-RestMethod http://127.0.0.1:8766/api/v1/health -TimeoutSec 1 | Out-Null
    throw 'Port 8766 is still owned by a running process; runtime was not replaced.'
} catch [System.Net.WebException] { }
$env:LOCAL_VOICE_DATA_DIR = $dataRoot
$env:HF_HOME = Join-Path $env:LOCALAPPDATA 'VoiceStudio\models\huggingface'
$env:LOCAL_VOICE_ALLOWED_ORIGINS = 'https://recording-voice-web.vercel.app,http://127.0.0.1:5173,http://localhost:5173'
$env:LOCAL_VOICE_AUTO_PAIR = '1'
$env:LOCAL_VOICE_PORT = '8766'
$process = Start-Process -FilePath $runtimePython -ArgumentList @('-m', 'local_runtime.app') -WorkingDirectory $appRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logsRoot 'local-dev-backend-out.log') -RedirectStandardError (Join-Path $logsRoot 'local-dev-backend-error.log')
Set-Content -Path $pidFile -Value $process.Id -Encoding ascii
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 500
    if ($process.HasExited) { throw 'Local runtime exited during startup.' }
    try {
        $health = Invoke-RestMethod http://127.0.0.1:8766/api/v1/health -TimeoutSec 2
        if ($health.status -eq 'ok' -and $health.os -eq 'Windows') {
            Write-Output "Voice Studio $($health.version) ready on http://127.0.0.1:8766; local UI http://127.0.0.1:5173"
            exit 0
        }
    } catch { }
}
throw 'Local runtime did not become ready.'
