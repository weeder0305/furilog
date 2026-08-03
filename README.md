# ふりろぐ（Furilog / WazaLog）

ダンスなどの練習動画を端末内に保存し、スロー再生・フレーム送りで細かく確認しながら、瞬間または時間区間に付箋を付け、動画横断のメモも残せる **個人用ローカル動画ノート** です。

- アカウント不要
- 広告・アクセス解析なし
- 動画・付箋・メモを運営者のサーバーへ送らない（端末内保存）

表示名は「ふりろぐ」。内部の保存名・コード上の呼称として `wazalog` が残っている箇所があります。

## できること

- 動画の追加（ファイル選択 / Android ではカメラ撮影）
- フォルダ・タグ・検索・並び替え
- 再生速度変更、左右反転、A/B リピート、フレーム送り
- 黄・赤・緑・青の瞬間／区間付箋
- 動画に紐づかないメモ帳
- Web 版は明示同意後にオフライン利用可能（ブラウザ管理領域）

## リポジトリ構成

| パス | 内容 |
|------|------|
| `app/` | 本体（React + TypeScript + Vite + Capacitor） |
| `support-site/` | サポート／プライバシー／Web 配信用サイト |
| `設計書.md` | 機能仕様と設計判断 |
| `release/` | ストア掲載文・プライバシー文案などの公開向け資料（バイナリは含まない） |
| `LICENSE` | MIT |

次のものは **意図的に公開していません**。

- 署名鍵・パスワード・`local.properties`
- APK / AAB などのビルド成果物
- 個人用の作業メモ・セッション引継ぎ・AI 用ローカル指示
- `.env` / `.openai/` / クラウドのプロジェクト ID・デプロイトークン

## セキュリティ（所有者向け・厳しめ）

公開リポジトリなので、**秘密が混ざらないこと**を機械的に止めます。

```powershell
# 初回だけ（commit/push 前の自動検査を有効化）
pwsh -File scripts/install-git-hooks.ps1

# いつでも手動検査（FAIL なら push しない）
pwsh -File scripts/security-check.ps1
```

- 方針・インシデント時の手順: [docs/security/はじめてのセキュリティ手順.md](./docs/security/はじめてのセキュリティ手順.md)
- 報告窓口: [SECURITY.md](./SECURITY.md)
- GitHub 上でも Secret scanning / Dependabot / CodeQL / Gitleaks を有効化

## 必要環境

- Node.js 20 以上を推奨（support-site は `>=22.13.0` の記載あり）
- Android ビルド時: Android SDK / Android Studio 同梱 JDK
- iOS プロジェクトは保管のみ（現行の App Store 公開対象外）

## アプリ本体の起動（Web / 開発）

```bash
cd app
npm install
npm run dev
```

ブラウザで表示される URL を開きます。

### よく使うコマンド

```bash
cd app
npm test          # Vitest
npm run lint      # Oxlint
npm run build     # Android 向け Web 資産ビルド
npm run build:web # Web/PWA 向けビルド
```

### Android

```bash
cd app
npm install
npm run build
npx cap sync android
```

その後 Android Studio で `app/android` を開き、実行または Gradle ビルドを行います。

Release 署名の秘密情報は **リポジトリ外のローカル設定** のみを使います（鍵・パスワードをコミットしません）。未設定のまま `bundleRelease` / `assembleRelease` を実行すると失敗します。デバッグビルドは署名設定なしで可能です。

## サポートサイト

```bash
cd support-site
npm install
npm run dev
```

- 本番のサイト URL はソースに直書きしません。必要なら `support-site/.env` に `SITE_URL=` を設定（`.env.example` 参照。`.env` は commit しない）。
- 個人のメールアドレスや OS ユーザー名付きパスはリポジトリに記載しません。

## ライセンス

[MIT License](./LICENSE)

## 連絡先

- 不具合・質問: このリポジトリの [GitHub Issues](https://github.com/weeder0305/furilog/issues)
- セキュリティ: [SECURITY.md](./SECURITY.md)
