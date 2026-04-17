import type { Configuration } from "@azure/msal-browser";

const clientId =
  process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID?.trim() || "PLACEHOLDER_CLIENT_ID";

export const graphScopes: string[] = (
  process.env.NEXT_PUBLIC_GRAPH_SCOPES ||
  "User.Read Sites.ReadWrite.All User.ReadBasic.All"
)
  .split(/[\s,]+/)
  .map((s) => s.trim())
  .filter(Boolean);

export function buildMsalConfig(): Configuration {
  const tenantId =
    process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID?.trim() || "common";
  /** 本番は必ず NEXT_PUBLIC_AZURE_AD_REDIRECT_URI をホストの HTTPS URL に合わせる。未設定時はブラウザでは現在の origin を使う */
  const redirectUri =
    process.env.NEXT_PUBLIC_AZURE_AD_REDIRECT_URI?.trim() ||
    (typeof window !== "undefined"
      ? `${window.location.origin}`
      : "http://localhost:3000");

  return {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri,
    },
    cache: {
      cacheLocation: "sessionStorage",
    },
  };
}
