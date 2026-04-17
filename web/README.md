# 業務報告・指示（Web）

SharePoint のリストに業務報告書・業務指示書を保存する Next.js アプリです。

## 運用方針（仕様）

**共用の Web（HTTPS の本番 URL）で利用する**ことを前提にします。  
社員はブラウザから本番 URL にアクセスし、Microsoft でサインインして使います。

- **本番**: **Vercel**（Hobby は多くの場合クレジットカード不要）や **Azure App Service** などにデプロイし、ホスト側の環境変数に本番値を載せる。
- **ローカル**（`npm run dev`）: 開発・検証用。本番と同じ Entra アプリ登録に、必要なら **リダイレクト URI を localhost 用にも追加**します。

## 本番デプロイ（概要）

1. **Node.js 20+** でビルド（CI でも可）。このリポジトリは `web/` がアプリ本体です。
2. **環境変数**: `web/env.example` を参照し、ホスト側に本番値を設定する。
3. **Entra ID**: リダイレクト URI に **`https://（本番ホスト）`** を登録し、`NEXT_PUBLIC_AZURE_AD_REDIRECT_URI` と一致させる。
4. **SharePoint**: サイト ID・リスト ID・列の内部名（必要なら `SHAREPOINT_*_FIELD_*`）を設定する。

### Vercel（クレジットカードを使わない Hobby の例）

1. [Vercel](https://vercel.com) で GitHub リポジトリをインポートする。
2. プロジェクト設定の **Root Directory** を **`web`** にする（このモノレポはアプリが `web/` にあるため）。
3. **Environment Variables** に `web/env.example` のキーを本番用の値で追加する。特に **`NEXT_PUBLIC_AZURE_AD_REDIRECT_URI`** は、デプロイ後に表示される **Production の HTTPS URL**（例: `https://プロジェクト名.vercel.app`）と**完全一致**（末尾スラッシュなし）にする。
4. **Microsoft Entra ID** の該当アプリ登録 → **認証** → リダイレクト URI（SPA）に、上記と同じ本番 URL を追加する。ローカル開発を続けるなら `http://localhost:3000` も併記する。
5. 再デプロイ（環境変数変更後は Redeploy が必要な場合あり）。

プレビュー URL（プルリクエストごとの `*.vercel.app`）でサインインまで試す場合は、Entra にその URL も追加するか、組織ポリシーに合わせて Preview 用のアプリ登録を分ける必要があります。社内共用の本番だけなら **Production URL だけ**で足ります。

GitHub Actions から Azure へ自動デプロイする例は `.github/workflows/azure-webapp.yml` を参照してください。

## ローカル開発

```bash
cd web
npm install
cp env.example .env.local
# .env.local を編集してから
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。LAN から別端末で試す場合は `next.config.ts` の `allowedDevOrigins` を調整してください。

## 技術スタック

Next.js（App Router）、Microsoft Graph、MSAL、SharePoint リスト連携。詳細は `env.example` のコメントを参照してください。
