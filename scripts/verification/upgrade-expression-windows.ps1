$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$appRoot = Join-Path $env:LOCALAPPDATA 'Programs\VoiceStudio'
$dataRoot = Join-Path $env:LOCALAPPDATA 'VoiceStudio\data'
$source = Join-Path $env:LOCALAPPDATA 'Temp\VoiceStudio-expression-install-20261115-b'
$backup = Join-Path $env:LOCALAPPDATA 'VoiceStudio\backups\pre-0.3.0-20261115'
if (-not (Test-Path (Join-Path $source 'model\experiment-manifest.json'))) { throw 'Verified expressive assets missing' }
if (Test-Path $backup) { throw 'Backup destination already exists' }
New-Item -ItemType Directory -Path $backup | Out-Null
$before = @{}
Get-ChildItem $dataRoot -File -Recurse | ForEach-Object {
    $relative = $_.FullName.Substring($dataRoot.Length + 1)
    $before[$relative] = (Get-FileHash $_.FullName -Algorithm SHA256).Hash
}
Copy-Item $dataRoot (Join-Path $backup 'data') -Recurse
$before | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $backup 'data-sha256.json') -Encoding UTF8
New-Item -ItemType Directory -Force -Path (Join-Path $appRoot '.venv-expression'), (Join-Path $env:LOCALAPPDATA 'VoiceStudio\models\huggingface\chatterbox-multilingual-v2') | Out-Null
& robocopy (Join-Path $source '.venv-expression') (Join-Path $appRoot '.venv-expression') /E /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -gt 7) { throw 'Could not copy isolated engine' }
& robocopy (Join-Path $source 'model') (Join-Path $env:LOCALAPPDATA 'VoiceStudio\models\huggingface\chatterbox-multilingual-v2') /E /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -gt 7) { throw 'Could not copy verified model' }
$after = @{}
Get-ChildItem $dataRoot -File -Recurse | ForEach-Object {
    $relative = $_.FullName.Substring($dataRoot.Length + 1)
    $after[$relative] = (Get-FileHash $_.FullName -Algorithm SHA256).Hash
}
if (($before | ConvertTo-Json -Compress) -ne ($after | ConvertTo-Json -Compress)) {
    foreach ($name in $before.Keys) { if ($before[$name] -ne $after[$name]) { throw "User data changed: $name" } }
    if ($before.Count -ne $after.Count) { throw 'User data file count changed' }
}
Write-Output "Backup and verified expressive assets prepared; user data files: $($before.Count)"
