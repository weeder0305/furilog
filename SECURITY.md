# Security Policy

## このアプリについて

ふりろぐは、動画・付箋・メモを **利用者の端末内** に保存する前提です。運営者へのクラウド同期や分析 SDK は入れていません。

## 脆弱性の報告

セキュリティ上の問題を見つけた場合は、**公開 Issue に詳細な攻撃手順や個人情報を載せない**でください。

報告方法:

1. 可能なら GitHub の [Private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)（リポジトリの Security タブ）
2. 使えない場合は、内容をぼかした Issue を立て、「詳細は非公開で共有したい」と書いてください

個人のメールアドレスはリポジトリに公開しません。

できるだけ次を含めてください。

- 影響範囲（Web / Android / サポートサイト）
- 再現手順
- 想定される影響
- 可能なら修正案

## 公開リポジトリに含めないもの

次をコミットしてはいけません。

- 署名鍵（`.jks` / `.keystore`）とパスワード
- API トークン、クラウド認証情報、`.env`
- 個人のメールアドレス・電話番号・住所
- Windows / macOS のユーザー名付き絶対パス（例: `C:\\Users\\...`）
- 利用者データ、内部運用メモ、未公開の Play 成果物

発見した場合はすぐに報告し、履歴からの除去を検討してください。公式手順: [Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)。
