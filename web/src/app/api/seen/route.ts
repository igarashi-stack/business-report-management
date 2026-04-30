import { bearerFromRequest } from "@/lib/graph/client";
import { getEffectiveUser } from "@/lib/graph/effectiveUser";
import { getListIdSeenItems, getSharePointSiteId } from "@/lib/graph/env";
import { listItems } from "@/lib/graph/listItems";
import { userSeenFromListItems } from "@/lib/graph/seenItems";

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
    const items = await listItems(token, siteId, listId);
    const seen = userSeenFromListItems(items, me.id);
    return Response.json({ seen, syncEnabled: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

