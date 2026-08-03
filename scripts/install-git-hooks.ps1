#Requires -Version 5.1
<#
.SYNOPSIS
  このリポジトリ専用の git hooks を有効化する（1回やればOK）。
#>
$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$hooksDir = Join-Path $RepoRoot ".githooks"
if (-not (Test-Path $hooksDir)) {
  throw "missing .githooks/"
}

& git config core.hooksPath .githooks
Write-Host "core.hooksPath = .githooks" -ForegroundColor Green
Write-Host "pre-commit / pre-push が有効です。今後の commit/push 前に自動検査します。"
Write-Host "手動検査:  pwsh -File scripts/security-check.ps1"
