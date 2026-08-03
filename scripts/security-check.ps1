#Requires -Version 5.1
<#
.SYNOPSIS
  ふりろぐ公開リポジトリ向け・過剰気味のローカル秘密検査。

.DESCRIPTION
  IT に詳しくなくても「赤が出たら push しない」だけで使える。
  - tracked ファイル名の危険パターン
  - テキスト内の典型的な秘密・PII
  - .gitignore が効いているかのサンプル確認

  終了コード: 0 = 問題なし / 1 = 危険あり（push 禁止）
#>
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

Write-Host "=== furilog security-check ===" -ForegroundColor Cyan
Write-Host "repo: $RepoRoot"

$fail = 0
function Fail([string]$Message) {
  Write-Host "[FAIL] $Message" -ForegroundColor Red
  $script:fail = 1
}
function Ok([string]$Message) {
  Write-Host "[ OK ] $Message" -ForegroundColor Green
}
function Info([string]$Message) {
  Write-Host "[INFO] $Message" -ForegroundColor DarkGray
}

# --- 1) 危険なパス名が tracked されていないか ---
$forbiddenPathRegex = @(
  # .env.example は公開してよい雛形。実 .env / .env.local 等だけ拒否
  '(^|/)\.env$',
  '(^|/)\.env\.(local|development|production|staging|test|prod|dev)(\.|$)',
  'local\.properties$',
  'google-services\.json$',
  'GoogleService-Info\.plist$',
  '\.jks$',
  '\.keystore$',
  '\.p12$',
  '(?<!\.gitleaks)\.pem$',
  'upload-key\.properties$',
  '(^|/)key\.properties$',
  'id_rsa',
  'id_ed25519',
  'credentials\.json$',
  'serviceAccount.*\.json$',
  '\.openai/',
  '\.wrangler/',
  'release/artifacts/'
)

$tracked = & git ls-files
foreach ($f in $tracked) {
  foreach ($rx in $forbiddenPathRegex) {
    if ($f -match $rx) {
      Fail "tracked forbidden path: $f"
    }
  }
}
if ($fail -eq 0) { Ok "no forbidden path names in git index" }

# --- 2) 内容パターン ---
$contentRules = @(
  @{ Name = "AWS access key"; Regex = 'AKIA[0-9A-Z]{16}' },
  @{ Name = "GitHub classic PAT"; Regex = 'ghp_[A-Za-z0-9]{36}' },
  @{ Name = "GitHub fine-grained PAT"; Regex = 'github_pat_[A-Za-z0-9_]{20,}' },
  @{ Name = "OpenAI-like sk-"; Regex = 'sk-[A-Za-z0-9]{20,}' },
  @{ Name = "Private key PEM"; Regex = '-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----' },
  @{ Name = "Windows user path"; Regex = 'C:\\Users\\[A-Za-z0-9._-]+' },
  @{ Name = "macOS user path"; Regex = '/Users/[A-Za-z0-9._-]+/' },
  # ドメイン先頭は英字必須（AppIcon@2x.png 等の誤検知を避ける）
  @{ Name = "Email address"; Regex = '[A-Za-z0-9._%+\-]+@[A-Za-z][A-Za-z0-9\-]*(\.[A-Za-z0-9\-]+)+' },
  @{ Name = "Hardcoded keystore password"; Regex = '(?i)(storePassword|keyPassword)\s*[=:]\s*[''"][^''"]{4,}[''"]' }
)

$skipPathRegex = 'package-lock\.json$|\.png$|\.jpe?g$|\.webp$|\.mp4$|\.jar$|\.svg$|\.gitleaks\.toml$|^docs/security/|^SECURITY\.md$|^scripts/security-check|^README\.md$|^\.github/workflows/secret-scan\.yml$'

foreach ($rule in $contentRules) {
  $hits = @()
  foreach ($f in $tracked) {
    if ($f -match $skipPathRegex) { continue }
    if (-not (Test-Path -LiteralPath $f)) { continue }
    try {
      $raw = Get-Content -LiteralPath $f -Raw -ErrorAction Stop
    } catch {
      continue
    }
    if ($null -eq $raw) { continue }
    if ($raw -match $rule.Regex) {
      $hits += $f
    }
  }
  if ($hits.Count -gt 0) {
    Fail ("{0}: {1}" -f $rule.Name, ($hits -join ", "))
  } else {
    Ok $rule.Name
  }
}

# --- 3) ローカル秘密が ignore されているか（存在する場合のみ） ---
$shouldBeIgnored = @(
  "app/android/local.properties",
  "support-site/.openai/hosting.json",
  "support-site/.wrangler",
  ".env",
  "app/.env",
  "support-site/.env",
  "release/artifacts"
)
foreach ($p in $shouldBeIgnored) {
  if (Test-Path -LiteralPath $p) {
    & git check-ignore -q -- $p
    if ($LASTEXITCODE -eq 0) {
      Ok "ignored (local ok): $p"
    } else {
      Fail "exists but NOT ignored: $p  ← これが一番危険。gitignore を直すまで push 禁止"
    }
  } else {
    Info "not present (ok): $p"
  }
}

# --- 4) 署名用プロパティがホーム外に無いことの注意喚起 ---
$homeProps = Join-Path $env:USERPROFILE ".android\furilog-release\upload-key.properties"
if (Test-Path $homeProps) {
  $trackedHome = $tracked | Where-Object { $_ -match 'upload-key\.properties' }
  if ($trackedHome) {
    Fail "upload-key.properties is tracked"
  } else {
    Ok "release signing props stay outside the repo ($homeProps)"
  }
} else {
  Info "no local release signing props (debug builds still fine)"
}

Write-Host ""
if ($fail -ne 0) {
  Write-Host "RESULT: FAIL — do NOT git push. See docs/security/はじめてのセキュリティ手順.md" -ForegroundColor Red
  exit 1
}
Write-Host "RESULT: PASS — push しても機械チェック上は致命傷なし" -ForegroundColor Green
exit 0
