$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$hostRoot = Join-Path (Split-Path $root -Parent) 'AppDock.at365'
$toolchain = Get-Content (Join-Path $hostRoot 'toolchain.json') -Raw | ConvertFrom-Json
$node = Join-Path $hostRoot ".tools\node\$($toolchain.node)\node.exe"
& $node (Join-Path $PSScriptRoot 'prepare-dev.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Development profile preparation failed' }
$electron = Join-Path $hostRoot 'node_modules\electron\dist\electron.exe'
$previous = $env:ELECTRON_RUN_AS_NODE
try {
    Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    Start-Process -FilePath $electron -ArgumentList @(('"{0}"' -f $hostRoot), ('"--test-profile={0}"' -f (Join-Path $root '.artifacts\gmail-dev')), '--test-command=at365.gmail.open') -WindowStyle Normal
} finally {
    if ($null -ne $previous) { $env:ELECTRON_RUN_AS_NODE = $previous }
}
