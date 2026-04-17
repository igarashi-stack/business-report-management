import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = dirname(webDir);
const cacheRoot = join(repoRoot, ".handoff-cache");
const outName = "business-report-management-handoff.zip";
const outPath = join(repoRoot, outName);

const INSTALLER_README_JA = `このフォルダには Node.js の公式インストーラー（LTS）が入っています。

【Windows（一般的な 64bit PC）】
  node-*-x64.msi をダブルクリックしてインストールしてください。

【Mac（Apple Silicon / Intel 共通）】
  node-*.pkg（拡張子 .pkg の1本）をダブルクリックしてインストールしてください。
  公式のユニバーサルインストーラです。

インストール後、ターミナルで node --version が表示されることを確認し、
ZIP 内の web フォルダへ移動して npm install → npm run dev してください。

公式サイト: https://nodejs.org/
`;

function semverCmpDesc(a, b) {
  const pa = a.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return db - da;
  }
  return 0;
}

async function fetchLatestLtsVersion() {
  const res = await fetch("https://nodejs.org/dist/index.json");
  if (!res.ok) throw new Error(`index.json HTTP ${res.status}`);
  const list = await res.json();
  const lts = list
    .filter((x) => x.lts)
    .map((x) => x.version)
    .sort(semverCmpDesc)[0];
  if (!lts) throw new Error("LTS バージョンが index.json から取得できませんでした");
  return lts;
}

function downloadCurl(url, dest) {
  execSync(`curl.exe -L --fail --silent --show-error -o "${dest}" "${url}"`, {
    stdio: "inherit",
  });
}

async function ensureInstallers(version, destDir) {
  mkdirSync(destDir, { recursive: true });
  const base = `https://nodejs.org/dist/${version}`;
  /** 現行 LTS は Mac が単一の .pkg（ユニバーサル）、Windows が x64.msi */
  const files = [`node-${version}-x64.msi`, `node-${version}.pkg`];
  for (const name of files) {
    const url = `${base}/${name}`;
    const out = join(destDir, name);
    if (existsSync(out)) {
      console.log("[pack:zip] キャッシュ利用:", name);
      continue;
    }
    console.log("[pack:zip] ダウンロード中:", url);
    try {
      downloadCurl(url, out);
    } catch {
      try {
        rmSync(out, { force: true });
      } catch {
        /* ignore */
      }
      throw new Error(`ダウンロード失敗: ${url}`);
    }
  }
}

function run(cmd, opts) {
  execSync(cmd, { ...opts, stdio: "inherit" });
}

async function main() {
  if (!existsSync(join(repoRoot, ".git"))) {
    console.error("[pack:zip] リポジトリのルートに .git がありません:", repoRoot);
    process.exit(1);
  }

  try {
    execSync(`git rev-parse --is-inside-work-tree`, { cwd: repoRoot, stdio: "pipe" });
  } catch {
    console.error("[pack:zip] git の作業ツリーではありません:", repoRoot);
    process.exit(1);
  }

  mkdirSync(cacheRoot, { recursive: true });
  const version = await fetchLatestLtsVersion();
  const installerCache = join(cacheRoot, "node-installers", version);
  await ensureInstallers(version, installerCache);

  const staging = join(cacheRoot, "staging");
  if (existsSync(staging)) {
    rmSync(staging, { recursive: true, force: true });
  }
  mkdirSync(staging, { recursive: true });

  const srcZip = join(cacheRoot, "git-export.zip");
  run(
    `git archive --format=zip -o "${srcZip.replace(/\\/g, "/")}" HEAD`,
    { cwd: repoRoot }
  );

  const ps = [
    "$ErrorActionPreference = 'Stop'",
    `Expand-Archive -LiteralPath '${srcZip.replace(/'/g, "''")}' -DestinationPath '${staging.replace(/'/g, "''")}' -Force`,
  ].join("; ");
  run(`powershell -NoProfile -Command "${ps}"`, { cwd: repoRoot });

  const toolsDir = join(staging, "tools", "nodejs-lts-installers");
  mkdirSync(toolsDir, { recursive: true });
  for (const name of [`node-${version}-x64.msi`, `node-${version}.pkg`]) {
    copyFileSync(join(installerCache, name), join(toolsDir, name));
  }
  writeFileSync(join(toolsDir, "README.txt"), INSTALLER_README_JA, "utf8");

  if (existsSync(outPath)) {
    rmSync(outPath, { force: true });
  }

  run(`tar -acf "${outPath.replace(/\\/g, "/")}" .`, { cwd: staging });

  rmSync(staging, { recursive: true, force: true });
  rmSync(srcZip, { force: true });

  console.log("");
  console.log("[pack:zip] 作成しました:", outPath);
  console.log(`  Node.js ${version} の公式インストーラー（Windows x64 .msi / Mac 共通 .pkg）を同梱しています。`);
  console.log("  展開先: tools/nodejs-lts-installers/");
  console.log("  ※ ソースは Git 追跡分のみ。.env.local / node_modules は含みません。");
  console.log("");
}

main().catch((e) => {
  console.error("[pack:zip] 失敗:", e);
  process.exit(1);
});
