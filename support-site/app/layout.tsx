import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://furilog-support.weeder0305.chatgpt.site"),
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
