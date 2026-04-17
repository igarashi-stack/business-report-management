import {
  mayImpersonateServer,
  parseImpersonationHeader,
} from "@/lib/dev/impersonation";
import { listDirectoryUsers } from "./directoryUsers";
import { getMe } from "./me";

export type EffectiveUser = {
  id: string;
  displayName: string;
  email: string;
  /** トークン上の実ユーザー */
  actualAzureAdId: string;
  isImpersonating: boolean;
  /** なりすまし時のみ: トークン保持者の表示名 */
  actualDisplayName?: string;
};

/**
 * 開発時: X-Dev-Impersonate-User-Id ヘッダーでアプリ上の「自分」を差し替え（テスト用）。
 * Graph の権限はトークンの実ユーザーに依存する点に注意。
 */
export async function getEffectiveUser(
  req: Request,
  accessToken: string
): Promise<EffectiveUser> {
  const me = await getMe(accessToken);
  const actualAzureAdId = me.id;
  const baseName = me.displayName ?? "";
  const baseEmail = me.mail || me.userPrincipalName || "";

  const want = parseImpersonationHeader(req);
  if (!want || want === actualAzureAdId) {
    return {
      id: actualAzureAdId,
      displayName: baseName || "ユーザー",
      email: baseEmail,
      actualAzureAdId,
      isImpersonating: false,
    };
  }

  // 本番でも ALLOW_DEV_IMPERSONATION を ON にできるが、実ログインが管理者（指定ID）のときだけ許可する。
  if (!mayImpersonateServer(actualAzureAdId)) {
    return {
      id: actualAzureAdId,
      displayName: baseName || "ユーザー",
      email: baseEmail,
      actualAzureAdId,
      isImpersonating: false,
    };
  }

  let displayName = `検証ユーザー (${want.slice(0, 8)}…)`;
  let email = "";
  try {
    const dir = await listDirectoryUsers(accessToken);
    const row = dir.find((u) => u.id === want);
    if (row) {
      displayName = row.displayName || displayName;
      email = row.mail || row.userPrincipalName || "";
    }
  } catch {
    /* ディレクトリ取得失敗時はプレースホルダのまま */
  }

  return {
    id: want,
    displayName,
    email,
    actualAzureAdId,
    isImpersonating: true,
    actualDisplayName: baseName || undefined,
  };
}
