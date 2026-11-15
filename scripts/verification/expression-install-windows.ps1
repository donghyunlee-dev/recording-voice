param([Parameter(Mandatory = $true)][string]$CheckRoot)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
New-Item -ItemType Directory -Force -Path $CheckRoot | Out-Null
$SourceRuntime = Join-Path $env:LOCALAPPDATA 'Programs\VoiceStudio\python'
if (-not (Test-Path (Join-Path $CheckRoot 'python'))) { New-Item -ItemType Junction -Path (Join-Path $CheckRoot 'python') -Target $SourceRuntime | Out-Null }
if (-not (Test-Path (Join-Path $CheckRoot '.venv\Scripts\python.exe'))) {
    & (Join-Path $SourceRuntime 'python.exe') -m venv (Join-Path $CheckRoot '.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Verification API environment failed.' }
}
$ApiPython = Join-Path $CheckRoot '.venv\Scripts\python.exe'
& $ApiPython -m pip install (Join-Path $RepoRoot 'local_runtime') huggingface_hub
if ($LASTEXITCODE -ne 0) { throw 'Verification API package failed.' }
& (Join-Path $RepoRoot 'scripts\windows\install-expression-engine.ps1') -InstallRoot $CheckRoot -ModelDirectory (Join-Path $CheckRoot 'model')
if ($LASTEXITCODE -ne 0) { throw 'Expressive installation failed.' }
& $ApiPython -c 'import sys; from pathlib import Path; from local_runtime.app.expression_worker import verify_assets; verify_assets(Path(sys.argv[1])); print(1)' (Join-Path $CheckRoot 'model')
if ($LASTEXITCODE -ne 0) { throw 'Installed asset verification failed.' }
