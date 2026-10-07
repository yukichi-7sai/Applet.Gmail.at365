param([switch]$Test)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$hostRoot = Join-Path (Split-Path $root -Parent) 'AppDock.at365'
$toolchain = Get-Content (Join-Path $hostRoot 'toolchain.json') -Raw | ConvertFrom-Json
$node = Join-Path $hostRoot ".tools\node\$($toolchain.node)\node.exe"
if (-not (Test-Path -LiteralPath $node)) { throw 'AppDockのdev.batでローカルツールを準備してください。' }
$arguments = @((Join-Path $PSScriptRoot 'build.cjs'))
if ($Test) { $arguments += '--test' }
& $node @arguments
if ($LASTEXITCODE -ne 0) { throw "Build failed: $LASTEXITCODE" }
