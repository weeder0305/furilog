# Security Policy

## このアプリについて

ふりろぐは、動画・付箋・メモを **利用者の端末内** に保存する前提です。運営者へのクラウド同期や分析 SDK は入れていません。

## 脆弱性の報告（外部の方向け）

セキュリティ上の問題を見つけた場合は、**公開 Issue に詳細な攻撃手順や個人情報・秘密情報を載せない**でください。

報告方法:

1. **推奨:** GitHub の [Private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)（リポジトリの **Security** タブ → Report a vulnerability）
2. 使えない場合のみ、内容をぼかした Issue を立て、「詳細は非公開で共有したい」と書いてください

個人のメールアドレスはリポジトリに公開しません。

できるだけ次を含めてください。

- 影響範囲（Web / Android / サポートサイト）
- 再現手順
- 想定される影響
- 可能なら修正案

対応の目安（努力目標）: 受信から **72 時間以内** に一次返信、深刻度に応じて修正方針を共有します。

## 公開リポジトリに含めないもの

次をコミットしてはいけません。

- 署名鍵（`.jks` / `.keystore`）とパスワード
- API トークン、クラウド認証情報、`.env`、`.openai/`、`.wrangler/`
- `google-services.json` / `GoogleService-Info.plist` / サービスアカウント JSON
- 個人のメールアドレス・電話番号・住所
- Windows / macOS のユーザー名付き絶対パス（例: `C:\Users\...`）
- 利用者データ、内部運用メモ、未公開の Play 成果物（APK / AAB）

発見した場合はすぐに報告し、**まず漏れた秘密を無効化**したうえで履歴からの除去を検討してください。

- 公式手順: [Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- **一度 push した秘密は漏洩とみなし、ローテーション（再発行）が本体**です。履歴削除だけでは不十分です。

## このリポジトリの自動防御（所有者メモ）

| 仕組み | 内容 |
|--------|------|
| GitHub Secret scanning + Push protection | 既知形式の秘密の検知と push 拒否 |
| Dependabot security updates | 依存の脆弱性修正 PR |
| Actions: Secret scan | Gitleaks + 危険パス名 + パターン検査 |
| Actions: CodeQL | 定期・PR 時の静的解析 |
| ローカル `scripts/security-check.ps1` | commit/push 前の検査 |
| `.githooks/` | pre-commit / pre-push で検査を強制 |

所有者向けの手順書（日本語・非エンジニア向け）:

- [docs/security/はじめてのセキュリティ手順.md](./docs/security/はじめてのセキュリティ手順.md)
- [docs/security/インシデント対応カード.md](./docs/security/インシデント対応カード.md)

## 対応方針（インシデント）

1. 追加の push を止める  
2. **漏れた認証情報をサービス側で無効化・再発行**  
3. リポジトリから当該データを削除  
4. 必要なら履歴掃除（公式ツール）  
5. 影響範囲の記録（秘密の値そのものは残さない）  
