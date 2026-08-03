# ふりろぐ — アプリ本体

このディレクトリがアプリ本体です（React + TypeScript + Vite + Capacitor）。

ルートの [README.md](../README.md) を先に読んでください。

## 開発

```bash
npm install
npm run dev
```

## 検証

```bash
npm test
npm run lint
npm run build
```

## ディレクトリ

- `src/` — UI と端末内保存（IndexedDB）
- `public/` — 静的資産・Service Worker・プライバシーページ
- `android/` — Capacitor Android プロジェクト
- `ios/` — Capacitor iOS プロジェクト（現行は App Store 公開対象外）
- `scripts/` — Web ビルド後処理・ストア資産生成
- `store-assets/` — アイコン・スクリーンショット原資
