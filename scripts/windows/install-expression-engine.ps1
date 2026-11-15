param(
    [Parameter(Mandatory = $true)]
    [string]$InstallRoot,
    [string]$ModelDirectory = (Join-Path $env:LOCALAPPDATA 'VoiceStudio\models\huggingface\chatterbox-multilingual-v2')
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$Python = Join-Path $InstallRoot 'python\python.exe'
$ApiPython = Join-Path $InstallRoot '.venv\Scripts\python.exe'
$EngineRoot = Join-Path $InstallRoot '.venv-expression'
$EnginePython = Join-Path $EngineRoot 'Scripts\python.exe'
if (-not (Test-Path $Python) -or -not (Test-Path $ApiPython)) {
    throw 'Install the Voice Studio runtime before installing the expressive engine.'
}
if (-not (Test-Path $EnginePython)) {
    & $Python -m venv $EngineRoot
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the isolated expressive environment.' }
}
$InstallLog = Join-Path $env:LOCALAPPDATA 'VoiceStudio\logs'
New-Item -ItemType Directory -Force -Path $InstallLog | Out-Null
$TorchInstall = Start-Process -FilePath $EnginePython -ArgumentList @('-m', 'pip', 'install', 'torch==2.6.0', 'torchaudio==2.6.0', '--index-url', 'https://download.pytorch.org/whl/cpu') -Wait -PassThru -RedirectStandardOutput (Join-Path $InstallLog 'expression-torch-out.log') -RedirectStandardError (Join-Path $InstallLog 'expression-torch-error.log')
if ($TorchInstall.ExitCode -ne 0) { throw 'Could not install expressive CPU dependencies. See expression-torch-error.log.' }
& $EnginePython -m pip install 'chatterbox-tts==0.1.7' 'transformers==5.2.0'
if ($LASTEXITCODE -ne 0) { throw 'Could not install the expressive engine.' }
& $EnginePython -m pip check
if ($LASTEXITCODE -ne 0) { throw 'Expressive dependency validation failed.' }
& $EnginePython -c 'from chatterbox.mtl_tts import ChatterboxMultilingualTTS'
if ($LASTEXITCODE -ne 0) { throw 'The expressive engine could not be loaded.' }
& $ApiPython -m local_runtime.app.expression_install $ModelDirectory
if ($LASTEXITCODE -ne 0) { throw 'Expressive model installation failed.' }
Write-Host 'Expressive engine installation completed.'
