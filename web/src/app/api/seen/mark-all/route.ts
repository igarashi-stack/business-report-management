import { bearerFromRequest } from "@/lib/graph/client";
import { getEffectiveUser } from "@/lib/graph/effectiveUser";
import { getListIdSeenItems, getSharePointSiteId } from "@/lib/graph/env";
import { createItem, listItems, patchItemFields } from "@/lib/graph/listItems";
import {
  type SeenItemType,
  findSeenListItem,
  resolveSeenFieldKeys,
} from "@/lib/graph/seenItems";

type Body = {
  type: SeenItemType;
  ids: string[];
  atMs?: number;
};

export async function POST(req: Request) {
  const token = bearerFromRequest(req);
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const me = await getEffectiveUser(req, token);
    const body = (await req.json()) as Partial<Body>;
    const type = body.type === "instruction" ? "instruction" : "report";
    const atMs = typeof body.atMs === "number" && body.atMs > 0 ? body.atMs : Date.now();
    const ids = Array.isArray(body.ids)
      ? body.ids.map((x) => String(x ?? "").trim()).filter(Boolean)
      : [];
    if (ids.length === 0) {
      return Response.json({ ok: true, updated: 0, created: 0 });
    }

    const siteId = getSharePointSiteId();
    const listId = getListIdSeenItems();
    if (!listId) {
      return Response.json({ ok: false, syncEnabled: false, updated: 0, created: 0 });
    }
    const keys = await resolveSeenFieldKeys(token, siteId, listId);
    const items = await listItems(token, siteId, listId);

    const tasks = ids.map(async (id) => {
      const existing = findSeenListItem(
        items,
        { userId: me.id, type, itemId: id },
        keys
      );
      if (existing) {
        await patchItemFields(token, siteId, listId, existing.id, {
          [keys.seenAtMs]: atMs,
        });
        return { updated: 1, created: 0 };
      }
      await createItem(token, siteId, listId, {
        Title: `${type}:${id}:${me.id}`,
        [keys.userId]: me.id,
        [keys.itemType]: type,
        [keys.itemId]: id,
        [keys.seenAtMs]: atMs,
      });
      return { updated: 0, created: 1 };
    });

    const results = await Promise.all(tasks);
    const updated = results.reduce((a, r) => a + r.updated, 0);
    const created = results.reduce((a, r) => a + r.created, 0);
    return Response.json({ ok: true, updated, created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

