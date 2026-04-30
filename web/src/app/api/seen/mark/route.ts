import { bearerFromRequest } from "@/lib/graph/client";
import { getEffectiveUser } from "@/lib/graph/effectiveUser";
import { getListIdSeenItems, getSharePointSiteId } from "@/lib/graph/env";
import { createItem, listItems, patchItemFields } from "@/lib/graph/listItems";
import {
  type SeenItemType,
  SEEN_FIELDS,
  findSeenListItem,
} from "@/lib/graph/seenItems";

type Body = {
  type: SeenItemType;
  id: string;
  atMs?: number;
};

export async function POST(req: Request) {
  const token = bearerFromRequest(req);
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const me = await getEffectiveUser(req, token);
    const body = (await req.json()) as Partial<Body>;
    const type = body.type === "instruction" ? "instruction" : "report";
    const id = String(body.id ?? "").trim();
    const atMs = typeof body.atMs === "number" && body.atMs > 0 ? body.atMs : Date.now();
    if (!id) {
      return Response.json({ error: "id が必要です" }, { status: 400 });
    }

    const siteId = getSharePointSiteId();
    const listId = getListIdSeenItems();
    if (!listId) {
      return Response.json({ ok: false, syncEnabled: false });
    }
    const items = await listItems(token, siteId, listId);
    const existing = findSeenListItem(items, { userId: me.id, type, itemId: id });

    if (existing) {
      await patchItemFields(token, siteId, listId, existing.id, {
        [SEEN_FIELDS.seenAtMs]: atMs,
      });
      return Response.json({ ok: true, updated: true });
    }

    await createItem(token, siteId, listId, {
      Title: `${type}:${id}:${me.id}`,
      [SEEN_FIELDS.userId]: me.id,
      [SEEN_FIELDS.itemType]: type,
      [SEEN_FIELDS.itemId]: id,
      [SEEN_FIELDS.seenAtMs]: atMs,
    });
    return Response.json({ ok: true, created: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

