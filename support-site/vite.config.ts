import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

type HostingConfig = {
  d1?: string | null;
  r2?: string | null;
  project_id?: string | null;
};

/**
 * 秘密・プロジェクト固有 ID を含む .openai/hosting.json は gitignore。
 * リポジトリには hosting.example.json（中身は null）だけを置く。
 */
function loadHostingConfig(): HostingConfig {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const privatePath = path.join(root, ".openai", "hosting.json");
  const examplePath = path.join(root, "hosting.example.json");
  const chosen = existsSync(privatePath) ? privatePath : examplePath;
  if (!existsSync(chosen)) {
    return { d1: null, r2: null, project_id: null };
  }
  const parsed = JSON.parse(readFileSync(chosen, "utf8")) as HostingConfig;
  return {
    d1: parsed.d1 ?? null,
    r2: parsed.r2 ?? null,
    // project_id はビルドに不要。ログやバンドルに載せない。
    project_id: null,
  };
}

const hostingConfig = loadHostingConfig();
const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
