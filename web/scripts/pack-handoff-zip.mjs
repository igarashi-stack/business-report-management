import { execSync, spawnSync } from "node:child_process";
import { platform } from "node:os";
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = dirname(webDir);
const cacheRoot = join(repoRoot, ".handoff-cache");
const outName = "business-report-management-handoff.zip";
const outPath = join(repoRoot, outName);

const PORTABLE_README_JA = `【Windows】
tools/node-portable/windows/ … 起動.cmd 用（ZIP 作成時に展開済み。追加インストール不要）

【Mac】
tools/nodejs-official-installers/*.pkg … Apple 公式インストーラ（ダブルクリックでインストール）
※ Windows PC から ZIP を作る都合上、Mac 用バイナリは tar 展開できないため .pkg 同梱です。
`;

const ZIP_USAGE_JA = `【かんたん手順】

1) この ZIP を「すべて展開」などでフォルダに出す

2) 次のどちらかをダブルクリック
   - Windows … 「起動.cmd」
     → 付属の Node でそのまま起動します（初回のみ npm install に少し時間がかかります）。
   - Mac … 「起動.command」
     → 初回だけ Node が未インストールなら、公式 .pkg のインストールが開きます。
       終了後にもう一度「起動.command」を開いてください。

3) .env.local を初めて作るときはメモが開くので、Client ID などを設定して保存し、
   もう一度「起動」をダブルクリック

4) ブラウザが http://localhost:3000 を開いたら利用開始です。
   終了はターミナルを閉じるか Ctrl+C です。

（Mac で「開発元が不明」と出たら、右クリック→開く を選んでください）
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

function run(cmd, opts) {
  execSync(cmd, { ...opts, stdio: "inherit" });
}

function tarExtract(archivePath, destDir) {
  mkdirSync(destDir, { recursive: true });
  const a = archivePath.replace(/\\/g, "/");
  const d = destDir.replace(/\\/g, "/");
  run(`tar -xf "${a}" -C "${d}"`, {});
}

function copyDirRecursive(src, dest) {
  if (platform() === "win32") {
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });
    const r = spawnSync(
      "robocopy",
      [src, dest, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np"],
      { encoding: "utf8", windowsHide: true }
    );
    const st = r.status ?? -1;
    if (st >= 8) {
      throw new Error(`robocopy が失敗しました (exit ${st}): ${r.stderr || ""}`);
    }
    return;
  }
  cpSync(src, dest, { recursive: true });
}

function soleChildDir(dir) {
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  if (names.length !== 1) {
    const all = readdirSync(dir);
    throw new Error(
      `想定外: ${dir} の直下にフォルダが1つではありません (dir=[${names.join(", ")}] all=[${all.join(", ")}])`
    );
  }
  return join(dir, names[0]);
}

/**
 * Windows 用ポータブル Node（win-x64.zip を展開）＋ Mac 用公式 .pkg（ファイルコピーのみ）
 */
function materializeNodeBundle(version, staging) {
  const base = `https://nodejs.org/dist/${version}`;
  const bundleCache = join(cacheRoot, "node-bundle", version);
  mkdirSync(bundleCache, { recursive: true });

  const winZip = join(bundleCache, `node-${version}-win-x64.zip`);
  const macPkg = join(bundleCache, `node-${version}.pkg`);

  for (const [label, urlPath, destPath] of [
    ["win-x64.zip", `node-${version}-win-x64.zip`, winZip],
    ["macOS .pkg", `node-${version}.pkg`, macPkg],
  ]) {
    const url = `${base}/${urlPath}`;
    if (!existsSync(destPath)) {
      console.log("[pack:zip] ダウンロード:", label);
      downloadCurl(url, destPath);
    } else {
      console.log("[pack:zip] キャッシュ利用:", label);
    }
  }

  const winUnpack = join(bundleCache, "_unpack-win", version);
  if (existsSync(winUnpack)) rmSync(winUnpack, { recursive: true, force: true });
  mkdirSync(winUnpack, { recursive: true });
  tarExtract(winZip, winUnpack);
  const winSrc = soleChildDir(winUnpack);
  const winDest = join(staging, "tools", "node-portable", "windows");
  mkdirSync(dirname(winDest), { recursive: true });
  copyDirRecursive(winSrc, winDest);
  rmSync(join(bundleCache, "_unpack-win"), { recursive: true, force: true });

  const macDir = join(staging, "tools", "nodejs-official-installers");
  mkdirSync(macDir, { recursive: true });
  copyFileSync(macPkg, join(macDir, `node-${version}.pkg`));

  writeFileSync(join(staging, "tools", "node-portable", "README.txt"), PORTABLE_README_JA, "utf8");
}

function writeLaunchers(staging, version) {
  const cmd = [
    "@echo off",
    "chcp 65001 >nul",
    'set "ROOT=%~dp0"',
    'set "PATH=%ROOT%tools\\node-portable\\windows;%PATH%"',
    'cd /d "%ROOT%web"',
    "where node >nul 2>&1",
    "if errorlevel 1 (",
    "  echo 付属の Node.js が見つかりません。ZIP をもう一度展開し直してください。",
    "  pause",
    "  exit /b 1",
    ")",
    'if not exist "node_modules" (',
    "  echo 初回のみ npm install を実行します…",
    "  call npm install",
    ")",
    'if not exist ".env.local" (',
    "  copy /Y env.example .env.local >nul",
    "  echo.",
    "  echo .env.local を作成しました。メモ帳で Client ID などを設定し、保存してから",
    "  echo もう一度「起動.cmd」をダブルクリックしてください。",
    "  echo.",
    "  start notepad .env.local",
    "  pause",
    "  exit /b 0",
    ")",
    "call npm run verify:env",
    "if errorlevel 1 (",
    "  echo .env.local に未設定があります。修正してからもう一度「起動.cmd」を実行してください。",
    "  pause",
    "  exit /b 1",
    ")",
    'start "" "http://localhost:3000/"',
    "echo.",
    "echo ブラウザを開きました。終了するときはこのウィンドウで Ctrl+C を押してください。",
    "echo.",
    "call npm run dev",
    "pause",
    "",
  ].join("\r\n");
  writeFileSync(join(staging, "起動.cmd"), cmd, "utf8");

  const pkgName = `node-${version}.pkg`;
  const sh = [
    "#!/bin/bash",
    "set -e",
    'ROOT="$(cd "$(dirname "$0")" && pwd)"',
    'export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"',
    'PKG="$ROOT/tools/nodejs-official-installers/' + pkgName + '"',
    'if ! command -v node >/dev/null 2>&1; then',
    '  if [[ -f "$PKG" ]]; then',
    '    echo "初回のみ Node.js インストーラを開きます。完了したらこのファイルをもう一度ダブルクリックしてください。"',
    '    open "$PKG"',
    "    exit 0",
    "  fi",
    '  echo "Node.js が見つかりません。https://nodejs.org/ から LTS をインストールしてください。"',
    "  exit 1",
    "fi",
    'cd "$ROOT/web"',
    'if [[ ! -d node_modules ]]; then',
    '  echo "初回のみ npm install を実行します…"',
    "  npm install",
    "fi",
    'if [[ ! -f .env.local ]]; then',
    "  cp env.example .env.local",
    "  echo",
    "  echo .env.local を作成しました。テキストエディタで編集して保存したら、",
    "  echo もう一度「起動.command」を開いてください。",
    "  echo",
    "  open -e .env.local || true",
    "  exit 0",
    "fi",
    "npm run verify:env || { echo .env.local を修正してから再実行してください。; exit 1; }",
    'open "http://localhost:3000/" 2>/dev/null || true',
    "npm run dev",
    "",
  ].join("\n");
  writeFileSync(join(staging, "起動.command"), sh, { encoding: "utf8" });

  writeFileSync(join(staging, "ZIPの使い方.txt"), ZIP_USAGE_JA, "utf8");
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

  console.log("[pack:zip] Node 同梱（Windows ポータブル + Mac .pkg）…");
  try {
    materializeNodeBundle(version, staging);
    writeLaunchers(staging, version);
  } catch (e) {
    console.error("[pack:zip] 同梱処理で失敗:", e);
    process.exit(1);
  }

  if (existsSync(outPath)) {
    rmSync(outPath, { force: true });
  }

  const st = staging.replace(/'/g, "''");
  const ou = outPath.replace(/'/g, "''");
  const zipPs = [
    "$ErrorActionPreference = 'Stop'",
    `$src = '${st}'`,
    `$dst = '${ou}'`,
    `$items = @(Get-ChildItem -LiteralPath $src | ForEach-Object { $_.FullName })`,
    "if ($items.Count -eq 0) { throw 'staging が空です' }",
    "Compress-Archive -LiteralPath $items -DestinationPath $dst -Force",
  ].join("; ");
  run(`powershell -NoProfile -Command "${zipPs}"`, { cwd: repoRoot });

  rmSync(staging, { recursive: true, force: true });
  rmSync(srcZip, { force: true });

  console.log("");
  console.log("[pack:zip] 作成しました:", outPath);
  console.log(`  Node.js ${version} … Windows は tools/node-portable/windows、Mac は tools/nodejs-official-installers/*.pkg`);
  console.log("  展開後は「起動.cmd」または「起動.command」をダブルクリックしてください。");
  console.log("  ※ ソースは Git 追跡分のみ。.env.local / node_modules は含みません。");
  console.log("");
}

main().catch((e) => {
  console.error("[pack:zip] 失敗:", e);
  process.exit(1);
});
