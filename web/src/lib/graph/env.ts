export function requireServerEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(`Missing env: ${name}`);
  }
  return v;
}

export function getSharePointSiteId(): string {
  return requireServerEnv("SHAREPOINT_SITE_ID");
}

/** 日報リスト（SharePoint 表示名は「日報」等で可）のリスト ID */
export function getListIdDailyReports(): string {
  return requireServerEnv("SHAREPOINT_LIST_DAILY_REPORTS_ID");
}

/** 業務指示書リストのリスト ID */
export function getListIdWorkInstructions(): string {
  return requireServerEnv("SHAREPOINT_LIST_WORK_INSTRUCTIONS_ID");
}

/** 既読管理リストのリスト ID（端末間で既読を同期するため必須） */
export function getListIdSeenItems(): string | undefined {
  const v = process.env.SHAREPOINT_LIST_SEEN_ITEMS_ID?.trim();
  return v && v.length > 0 ? v : undefined;
}

/**
 * アプリユーザー（権限）リストのリスト ID。
 * 現行の一覧・日報・指示書 API では未使用。将来の権限連携用。未設定可。
 */
export function getListIdAppUsers(): string | undefined {
  const v = process.env.SHAREPOINT_LIST_APP_USERS_ID?.trim();
  return v && v.length > 0 ? v : undefined;
}

/**
 * 「手持ち案件」専用リスト（任意）。
 * 設定すると別端末でも同期。未設定時はブラウザ localStorage のみ。
 */
export function getListIdHandheldProjects(): string | undefined {
  const v = process.env.SHAREPOINT_LIST_HANDHELD_PROJECTS_ID?.trim();
  return v && v.length > 0 ? v : undefined;
}

