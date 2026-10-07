param([string]$AppDockDirectory)
$ErrorActionPreference = 'Stop'
function Get-Sha256([string]$File) {
    $stream = [IO.File]::OpenRead($File)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { [BitConverter]::ToString($sha.ComputeHash($stream)) }
    finally { $sha.Dispose(); $stream.Dispose() }
}
$root = Split-Path $PSScriptRoot -Parent
if (-not $AppDockDirectory) {
    $config = Join-Path $root 'deploy.local.txt'
    if (Test-Path -LiteralPath $config) { $AppDockDirectory = Get-Content -LiteralPath $config -Encoding UTF8 -TotalCount 1 }
}
if (-not $AppDockDirectory -or -not (Test-Path -LiteralPath (Join-Path $AppDockDirectory 'AppDock.at365.exe'))) {
    throw 'AppDock.at365.exeが存在する配置先を引数またはdeploy.local.txtで指定してください。'
}
& (Join-Path $PSScriptRoot 'publish.ps1')
$source = Join-Path $root 'publish\Applet.Gmail.at365'
$target = Join-Path $AppDockDirectory 'extensions\Applet.Gmail.at365'
New-Item -ItemType Directory -Path $target -Force | Out-Null
Get-ChildItem -LiteralPath $source -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($source.Length + 1)
    $destination = Join-Path $target $relative
    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $destination -Force
    if ((Get-Sha256 $_.FullName) -ne (Get-Sha256 $destination)) { throw '配置後のハッシュが一致しません。' }
}
Write-Host "Deployed: $target"
