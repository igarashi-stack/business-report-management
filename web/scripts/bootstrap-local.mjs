import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, ".env.local");
const src = join(root, "env.example");

if (existsSync(dest)) {
  console.log("[bootstrap:local] .env.local は既にあります（上書きしません）。");
} else {
  copyFileSync(src, dest);
  console.log("[bootstrap:local] env.example をコピーして .env.local を作成しました。");
}

console.log("");
console.log("次はあなた側の作業です:");
console.log("  1) Entra ID でアプリ登録（SPA・リダイレクト URI は .env.local の NEXT_PUBLIC_AZURE_AD_REDIRECT_URI と一致）");
console.log("  2) API の権限に管理者同意");
console.log("  3) SharePoint にリスト作成・サイト/リスト ID を .env.local に記入");
console.log("  4) npm run verify:env で未設定項目を確認");
console.log("  5) npm run dev（同じ Wi-Fi のスマホから試すなら npm run dev:lan と next.config の allowedDevOrigins）");
console.log("");
