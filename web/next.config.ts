import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** 共用 Web（本番）向け: Azure App Service / GitHub Actions で standalone を配布しやすくする */
  output: "standalone",
  /**
   * ローカル開発（next dev）のみ: LAN 内 IP からアクセスすると /_next/* がブロックされることがあるため許可する。
   * 本番（npm start / App Service）では通常不要。
   */
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.147"],
};

export default nextConfig;
