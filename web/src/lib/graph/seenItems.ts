import { graphRequest } from "@/lib/graph/client";
import type { GraphListItem } from "@/lib/graph/listItems";

type Fields = Record<string, unknown>;

/** Graph は列の「内部名」。表示名と違う場合は .env の SHAREPOINT_*_FIELD_* で上書き */
function spField(envName: string, fallback: string): string {
  const v = process.env[envName]?.trim();
  return v && v.length > 0 ? v : fallback;
}

export type SeenItemType = "report" | "instruction";

export const SEEN_FIELDS = {
  /** Azure AD User ID（アプリ側 user.id） */
  userId: spField("SHAREPOINT_SEEN_FIELD_USER_ID", "ユーザーID"),
  /** "report" | "instruction" */
  itemType: spField("SHAREPOINT_SEEN_FIELD_ITEM_TYPE", "種類"),
  /** 対象ドキュメントの ID */
  itemId: spField("SHAREPOINT_SEEN_FIELD_ITEM_ID", "ドキュメントID"),
  /** 既読時刻（ms）。Number 列推奨 */
  seenAtMs: spField("SHAREPOINT_SEEN_FIELD_SEEN_AT_MS", "既読日時ms"),
} as const;

export type SeenFieldKeys = {
  userId: string;
  itemType: string;
  itemId: string;
  seenAtMs: string;
};

type GraphColumn = { name?: string; displayName?: string };

function normalizeName(s: unknown): string {
  return String(s ?? "").trim();
}

/**
 * SharePoint 列は「表示名」と Graph の fields で使う「内部名」が異なることがあるため、
 * columns API から内部名を自動解決する。
 */
export async function resolveSeenFieldKeys(
  accessToken: string,
  siteId: string,
  listId: string
): Promise<SeenFieldKeys> {
  const desired: SeenFieldKeys = {
    userId: SEEN_FIELDS.userId,
    itemType: SEEN_FIELDS.itemType,
    itemId: SEEN_FIELDS.itemId,
    seenAtMs: SEEN_FIELDS.seenAtMs,
  };

  const cols = await graphRequest<{ value?: GraphColumn[] }>(
    accessToken,
    `/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/columns?$select=name,displayName`
  );

  const byDisplay = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const c of cols.value ?? []) {
    const name = normalizeName(c.name);
    const disp = normalizeName(c.displayName);
    if (name) byName.set(name, name);
    if (disp && name) byDisplay.set(disp, name);
  }

  const resolve = (want: string) => byName.get(want) ?? byDisplay.get(want) ?? want;
  return {
    userId: resolve(desired.userId),
    itemType: resolve(desired.itemType),
    itemId: resolve(desired.itemId),
    seenAtMs: resolve(desired.seenAtMs),
  };
}

function asString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function asNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeUserId(userId: string): string {
  return String(userId ?? "").trim().toLowerCase();
}

export type UserSeen = {
  reports: Record<string, number>;
  instructions: Record<string, number>;
};

export function userSeenFromListItems(
  items: GraphListItem[],
  userIdRaw: string,
  keys: SeenFieldKeys = SEEN_FIELDS
): UserSeen {
  const userId = normalizeUserId(userIdRaw);
  const reports: Record<string, number> = {};
  const instructions: Record<string, number> = {};
  for (const it of items) {
    const f = it.fields as Fields | undefined;
    if (!f) continue;
    if (normalizeUserId(asString(f[keys.userId])) !== userId) continue;
    const t = asString(f[keys.itemType]) as SeenItemType;
    const docId = asString(f[keys.itemId]);
    const seenAt = asNumber(f[keys.seenAtMs]);
    if (!docId || !(seenAt > 0)) continue;
    if (t === "report") reports[docId] = Math.max(reports[docId] ?? 0, seenAt);
    else if (t === "instruction") {
      instructions[docId] = Math.max(instructions[docId] ?? 0, seenAt);
    }
  }
  return { reports, instructions };
}

export type SeenKey = {
  userId: string;
  type: SeenItemType;
  itemId: string;
};

export function findSeenListItem(
  items: GraphListItem[],
  key: SeenKey,
  keys: SeenFieldKeys = SEEN_FIELDS
): GraphListItem | undefined {
  const uid = normalizeUserId(key.userId);
  const itemId = asString(key.itemId);
  const type = key.type;
  return items.find((it) => {
    const f = it.fields as Fields | undefined;
    if (!f) return false;
    return (
      normalizeUserId(asString(f[keys.userId])) === uid &&
      asString(f[keys.itemType]) === type &&
      asString(f[keys.itemId]) === itemId
    );
  });
}

export async function patchSeenItemFields(
  accessToken: string,
  siteId: string,
  listId: string,
  listItemId: string,
  fields: Fields
) {
  return graphRequest<unknown>(
    accessToken,
    `/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(listItemId)}/fields`,
    { method: "PATCH", body: JSON.stringify(fields) }
  );
}

