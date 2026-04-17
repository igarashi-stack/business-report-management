# ZIP で別 PC（Windows / Mac）に渡す手順

**運用の主軸は「共用の Web（HTTPS）にデプロイした URL」です。**  
ZIP 配布は、オフラインでの受け渡し・一時的な検証・バックアップ用途の補助手段として使ってください（手順は `web/README.md`）。

## 渡す側（いまの PC）

1. リポジトリの変更は必要なら **commit** しておく（ZIP には **Git に載っているファイルだけ** が入ります）。
2. ターミナルで `web` フォルダへ移動し、次を実行する。

```bash
cd web
npm run pack:zip
```

- **初回は数分かかることがあります**（公式サイトから Node.js **LTS** を取得して ZIP に同梱するため。`curl` が使える Windows 想定）。
- 2回目以降は `.handoff-cache/` にキャッシュが残り、同じバージョンなら再ダウンロードを省略します。

3. リポジトリの **ルート**（`Business report management` フォルダの直下）に  
   **`business-report-management-handoff.zip`** ができます。  
4. この ZIP を USB・共有フォルダ・社内ストレージなど **安全な経路**で相手に渡す。
5. **`.env.local` は ZIP に含まれません。**  
   別途、パスワード管理ツールや社内ルールに従って相手に渡してください（中身は各自の PC で `web/.env.local` に保存）。

### 同梱される Node.js

- **Windows**: `tools/node-portable/windows/` に **展開済みの Node**（追加インストール不要で `起動.cmd` が使えます）
- **Mac**: `tools/nodejs-official-installers/` に **公式 `.pkg`**（初回だけインストール。Windows から ZIP を作る都合上、Mac 用は tar 展開ではなく pkg 同梱です）

---

## 受け取る側（Windows でも Mac でも可）

### いちばんかんたんな方法

1. ZIP を展開する  
2. **`起動.cmd`（Windows）** または **`起動.command`（Mac）** をダブルクリック  
3. 画面の案内に従う（`.env.local` が無いときは編集のためメモ帳等が開きます）  

詳細は同梱の **`ZIPの使い方.txt`** も参照してください。

### 手動で進める場合（従来どおり）

1. 展開したフォルダ内の **`web`** を開く。
2. ターミナル（Mac は「ターミナル.app」、Windows は PowerShell）で:

```bash
cd web
npm install
npm run bootstrap:local
```

3. 管理者から受け取った内容で **`web/.env.local`** を編集する（または既にファイルがある場合は上書き・追記）。
4. 確認:

```bash
npm run verify:env
```

5. 起動:

```bash
npm run dev
```

6. ブラウザで **`http://localhost:3000`** を開き、**自分の Microsoft アカウントでサインイン**する。

### Mac での注意

- **初回**、`起動.command` が **Node の `.pkg` インストール**を開くことがあります。完了後にもう一度 `起動.command` を開いてください。
- 「開発元が不明」と出たら **右クリック → 開く** を選んでください。

---

## よくある質問

**Q. Mac でも動きますか？**  
A. はい。初回だけ公式 `.pkg` で Node を入れてから、同じ手順で `npm run dev` します。

**Q. 相手も同じ SharePoint を見られますか？**  
A. **同じ Microsoft 365 テナントのユーザー**で、**その SharePoint サイトへのアクセス権**があれば同じリストを使えます。

**Q. ZIP に秘密を入れたくない**  
A. この手順の ZIP には **`.env.local` は入りません**（Git 未追跡のため）。秘密は必ず別経路で渡してください。
