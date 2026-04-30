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
  userIdRaw: string
): UserSeen {
  const userId = normalizeUserId(userIdRaw);
  const reports: Record<string, number> = {};
  const instructions: Record<string, number> = {};
  for (const it of items) {
    const f = it.fields as Fields | undefined;
    if (!f) continue;
    if (normalizeUserId(asString(f[SEEN_FIELDS.userId])) !== userId) continue;
    const t = asString(f[SEEN_FIELDS.itemType]) as SeenItemType;
    const docId = asString(f[SEEN_FIELDS.itemId]);
    const seenAt = asNumber(f[SEEN_FIELDS.seenAtMs]);
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
  key: SeenKey
): GraphListItem | undefined {
  const uid = normalizeUserId(key.userId);
  const itemId = asString(key.itemId);
  const type = key.type;
  return items.find((it) => {
    const f = it.fields as Fields | undefined;
    if (!f) return false;
    return (
      normalizeUserId(asString(f[SEEN_FIELDS.userId])) === uid &&
      asString(f[SEEN_FIELDS.itemType]) === type &&
      asString(f[SEEN_FIELDS.itemId]) === itemId
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

