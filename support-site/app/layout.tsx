import type { Metadata } from "next";
import "./globals.css";

/**
 * 本番ホスト名をソースに直書きしない。
 * デプロイ環境またはローカル .env の SITE_URL / NEXT_PUBLIC_SITE_URL を使う。
 * 未設定時は開発用 localhost（OGP の絶対 URL が要る本番では必ず設定）。
 */
function resolveMetadataBase(): URL {
  const candidates = [
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.CF_PAGES_URL,
  ];
  for (const raw of candidates) {
    if (!raw || !raw.trim()) continue;
    try {
      return new URL(raw.trim());
    } catch {
      // 次の候補へ
    }
  }
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: "ふりろぐ｜ダンス動画の振り返りノート",
  description: "ダンス動画をフレーム単位で確認し、付箋とメモで練習を記録するローカル動画ノート。",
  icons: { icon: "/app-icon.png" },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    title: "ふりろぐ｜ダンス動画の振り返りノート",
    description: "ダンス動画をフレーム単位で確認し、気づきを端末内の付箋とメモに残せます。",
    images: [{ url: "/og.png", width: 1743, height: 909, alt: "ふりろぐ — ダンス動画を、フレームで振り返る。" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ふりろぐ｜ダンス動画の振り返りノート",
    description: "ダンス動画をフレーム単位で確認し、気づきを端末内の付箋とメモに残せます。",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
