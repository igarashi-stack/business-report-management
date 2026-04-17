import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Azure App Service / GitHub Actions へデプロイしやすいよう本番は単体実行用バンドルを出力 */
  output: "standalone",
  /**
   * 開発時に LAN 内 IP からアクセスすると Next の dev リソース（/_next/*）が
   * クロスオリジンとしてブロックされ、画面が読み込み続けることがあるため許可する。
   */
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.147"],
};

export default nextConfig;
