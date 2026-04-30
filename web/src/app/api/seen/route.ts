import { bearerFromRequest } from "@/lib/graph/client";
import { getEffectiveUser } from "@/lib/graph/effectiveUser";
import { getListIdSeenItems, getSharePointSiteId } from "@/lib/graph/env";
import { listItems } from "@/lib/graph/listItems";
import { resolveSeenFieldKeys, userSeenFromListItems } from "@/lib/graph/seenItems";

export async function GET(req: Request) {
  const token = bearerFromRequest(req);
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const me = await getEffectiveUser(req, token);
    const siteId = getSharePointSiteId();
    const listId = getListIdSeenItems();
    if (!listId) {
      return Response.json({
        seen: { reports: {}, instructions: {} },
        syncEnabled: false,
      });
    }
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";
    const keys = await resolveSeenFieldKeys(token, siteId, listId);
    const items = await listItems(token, siteId, listId);
    const seen = userSeenFromListItems(items, me.id, keys);
    if (!debug) {
      return Response.json({ seen, syncEnabled: true });
    }
    // debug=1: 列の解決結果と、生データ（先頭数件）を返す
    const sample = items
      .slice(0, 5)
      .map((it) => ({
        id: it.id,
        fields: it.fields ?? {},
      }));
    return Response.json({
      seen,
      syncEnabled: true,
      debug: {
        resolvedKeys: keys,
        totalItems: items.length,
        sample,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

