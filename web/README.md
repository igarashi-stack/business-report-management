# 業務報告・指示（Web）

SharePoint のリストに業務報告書・業務指示書を保存する Next.js アプリです。

## 運用方針（仕様）

**共用の Web（HTTPS の本番 URL）で利用する**ことを前提にします。  
社員はブラウザから本番 URL にアクセスし、Microsoft でサインインして使います。

- **本番**: Azure App Service などにデプロイし、アプリ設定に環境変数を載せる（例: リポジトリの `.github/workflows/azure-webapp.yml`）。
- **ローカル**（`npm run dev`）: 開発・検証用。本番と同じ Entra アプリ登録に、必要なら **リダイレクト URI を localhost 用にも追加**します。

## 本番デプロイ（概要）

1. **Node.js 20+** でビルド（CI でも可）。このリポジトリは `web/` がアプリ本体です。
2. **環境変数**: `web/env.example` を参照し、ホスト側のアプリ設定に本番値を設定する。
3. **Entra ID**: リダイレクト URI に **`https://（本番ホスト）`** を登録し、`NEXT_PUBLIC_AZURE_AD_REDIRECT_URI` と一致させる。
4. **SharePoint**: サイト ID・リスト ID・列の内部名（必要なら `SHAREPOINT_*_FIELD_*`）を設定する。

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
