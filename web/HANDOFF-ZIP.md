# ZIP で別 PC（Windows / Mac）に渡す手順

## 渡す側（いまの PC）

1. リポジトリの変更は必要なら **commit** しておく（ZIP には **Git に載っているファイルだけ** が入ります）。
2. ターミナルで `web` フォルダへ移動し、次を実行する。

```bash
cd web
npm run pack:zip
```

- **初回は数分かかることがあります**（公式サイトから Node.js **LTS** のインストーラーを取得して ZIP に同梱するため。`curl` が使える Windows 想定）。
- 2回目以降は `.handoff-cache/` にキャッシュが残り、同じバージョンなら再ダウンロードを省略します。

3. リポジトリの **ルート**（`Business report management` フォルダの直下）に  
   **`business-report-management-handoff.zip`** ができます。  
4. この ZIP を USB・共有フォルダ・社内ストレージなど **安全な経路**で相手に渡す。
5. **`.env.local` は ZIP に含まれません。**  
   別途、パスワード管理ツールや社内ルールに従って相手に渡してください（中身は各自の PC で `web/.env.local` に保存）。

---

## 受け取る側（Windows でも Mac でも可）

### 共通の準備

- **Node.js 20 以降**が必要です。次のどちらかで入れてください。
  - **ZIP 内のインストーラー（推奨）**: 展開後の **`tools/nodejs-lts-installers/`** に、Windows 用 **`*-x64.msi`** と Mac 用 **`node-*.pkg`（ユニバーサル1本）** と **`README.txt`** があります。OS に合わせて実行してください。
  - **自分で入手する場合**: [https://nodejs.org/](https://nodejs.org/) の LTS をインストール。
- ZIP を展開する（フォルダ名は任意）

### 手順

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

- コマンドは **プロジェクトの `web` フォルダで**実行する（上記の `cd web`）。
- ファイアウォールやセキュリティソフトが Node を止めないか、初回だけ確認することがあります。

---

## よくある質問

**Q. Mac でも動きますか？**  
A. はい。Next.js は Windows / Mac のどちらでも、`web` で `npm install` と `npm run dev` が通れば同じように動きます。

**Q. 相手も同じ SharePoint を見られますか？**  
A. **同じ Microsoft 365 テナントのユーザー**で、**その SharePoint サイトへのアクセス権**があれば同じリストを使えます。

**Q. ZIP に秘密を入れたくない**  
A. この手順の ZIP には **`.env.local` は入りません**（Git 未追跡のため）。秘密は必ず別経路で渡してください。
