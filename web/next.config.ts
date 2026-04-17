import type { NextConfig } from "next";

/** Vercel 上の `next build` では VERCEL=1。standalone は自ホスト（Azure 等）向けで、Vercel 既定ビルドと併用しない。 */
const useStandalone = process.env.VERCEL !== "1";

const nextConfig: NextConfig = {
  ...(useStandalone ? { output: "standalone" as const } : {}),
  /**
   * ローカル開発（next dev）のみ: LAN 内 IP からアクセスすると /_next/* がブロックされることがあるため許可する。
   * 本番（npm start / App Service）では通常不要。
   */
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.147"],
};

export default nextConfig;
