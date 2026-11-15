param([Parameter(Mandatory = $true)][string]$Python)
$ErrorActionPreference = 'Stop'
$sandbox = Join-Path $env:TEMP ('VoiceStudio-stop-test-' + [guid]::NewGuid())
$originalAppData = $env:LOCALAPPDATA
$ownedIds = @()
try {
    $venv = Join-Path $sandbox 'runtime'
    & $Python -m venv --without-pip $venv
    if ($LASTEXITCODE -ne 0) { throw 'Test environment creation failed' }
    $env:LOCALAPPDATA = Join-Path $sandbox 'appdata'
    $state = Join-Path $env:LOCALAPPDATA 'VoiceStudio'
    New-Item -ItemType Directory -Force $state | Out-Null
    $process = Start-Process (Join-Path $venv 'Scripts\python.exe') -ArgumentList '-c "import time; time.sleep(120)"' -PassThru -WindowStyle Hidden
    $ownedIds += $process.Id
    $children = @()
    for ($attempt = 0; $attempt -lt 20 -and $children.Count -eq 0; $attempt++) {
        Start-Sleep -Milliseconds 100
        $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $($process.Id)")
    }
    if ($children.Count -eq 0) { throw 'Expected a native Windows venv child process' }
    $ownedIds += @($children | ForEach-Object { $_.ProcessId })
    $pidFile = Join-Path $state 'backend.pid'
    $uninstaller = Join-Path $PSScriptRoot '..\windows\uninstall-local-voice.ps1'

    Set-Content $pidFile $process.Id
    & $uninstaller -InstallRoot (Join-Path $sandbox 'unrelated')
    foreach ($ownedId in $ownedIds) {
        if (-not (Get-Process -Id $ownedId -ErrorAction SilentlyContinue)) { throw 'Unrelated installation process was terminated' }
    }

    Set-Content $pidFile $process.Id
    & $uninstaller -InstallRoot $venv
    Start-Sleep -Milliseconds 500
    $remaining = @($ownedIds | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue })
    if ($remaining.Count) { throw "Backend descendants survived uninstall: $remaining" }
    if (Test-Path $pidFile) { throw 'PID file was not cleared' }
    Write-Output 'PASS: owned process tree stopped; unrelated installation preserved'
} finally {
    $env:LOCALAPPDATA = $originalAppData
    foreach ($ownedId in $ownedIds) { Stop-Process -Id $ownedId -Force -ErrorAction SilentlyContinue }
}
