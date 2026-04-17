import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = dirname(webDir);
const outName = "business-report-management-handoff.zip";
const outPath = join(repoRoot, outName);

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

execSync(
  `git archive --format=zip -o "${outPath.replace(/\\/g, "/")}" HEAD`,
  { cwd: repoRoot, stdio: "inherit" }
);

console.log("");
console.log("[pack:zip] 作成しました:", outPath);
console.log("  ※ Git に追跡されているファイルのみ同梱されます（node_modules / .env.local は含みません）。");
console.log("");
