param(
    [Parameter(Mandatory = $true)]
    [string]$InstallRoot
)

$ErrorActionPreference = "Stop"
$PidFile = Join-Path $env:LOCALAPPDATA "VoiceStudio\backend.pid"
if (-not (Test-Path $PidFile)) { exit 0 }

$processId = 0
if (-not [int]::TryParse((Get-Content -Raw $PidFile).Trim(), [ref]$processId)) { exit 0 }
$process = Get-Process -Id $processId -ErrorAction SilentlyContinue
if ($null -eq $process) { Remove-Item -Force $PidFile; exit 0 }
try {
    $processPath = $process.Path
    $runtimeRoot = [IO.Path]::GetFullPath($InstallRoot).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if ($processPath -and [IO.Path]::GetFullPath($processPath).StartsWith($runtimeRoot, [StringComparison]::OrdinalIgnoreCase)) {
        Stop-Process -Id $processId -Force
    }
} finally {
    Remove-Item -Force $PidFile -ErrorAction SilentlyContinue
}
