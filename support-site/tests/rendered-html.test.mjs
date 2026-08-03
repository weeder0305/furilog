import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the finished Japanese support site with security headers", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ja">/i);
  assert.match(html, /<title>ふりろぐ｜ダンス動画の振り返りノート<\/title>/i);
  assert.match(html, /説明を確認して端末に保存/);
  assert.match(html, /Webサイトの配信とお問い合わせ/);
  assert.match(html, /内蔵カメラは別途配布するAndroidアプリ版の機能/);
  assert.match(html, /対応上必要でなくなった後に削除/);
  assert.match(html, /ギャラリーから削除してもアプリ内の動画は残り/);
  assert.match(html, /別のブラウザ、別の利用者プロファイル/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
});

test("installer requires explicit consent and uses external scripts", async () => {
  const [installer, installerScript, serviceWorker] = await Promise.all([
    readFile(new URL("../public/setup/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/setup/install.js", import.meta.url), "utf8"),
    readFile(new URL("../public/app/sw.js", import.meta.url), "utf8"),
  ]);
  assert.match(installer, /id="consent" type="checkbox"/);
  assert.match(installer, /id="install" type="button" disabled/);
  assert.match(installer, /別のブラウザ、別プロファイル/);
  assert.match(installer, /保存場所・データ削除/);
  assert.match(installer, /<script src="\/setup\/install\.js"><\/script>/);
  assert.match(installerScript, /if \(!consent\.checked/);
  assert.match(installerScript, /private browsing may block this optional receipt/i);
  assert.match(serviceWorker, /failed update must leave the previously active worker/i);
  assert.match(serviceWorker, /event\.waitUntil\(cacheAppShell\(\)\.then\(\(\) => self\.skipWaiting\(\)\)\)/);
});

test("image transformation endpoint is disabled", async () => {
  const response = await render("/_vinext/image?url=%2Fapp-icon.png&w=640&q=75");
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
});
