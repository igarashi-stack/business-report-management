import { bearerFromRequest } from "@/lib/graph/client";
import { getEffectiveUser } from "@/lib/graph/effectiveUser";
import { mayImpersonateServer } from "@/lib/dev/impersonation";

export async function GET(req: Request) {
  const token = bearerFromRequest(req);
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const u = await getEffectiveUser(req, token);
    const canImpersonate = mayImpersonateServer(u.actualAzureAdId);
    return Response.json({
      user: {
        id: u.id,
        displayName: u.displayName,
        email: u.email,
      },
      dev: {
        canImpersonate,
        ...(u.isImpersonating
          ? {
              impersonating: true as const,
              actualUserId: u.actualAzureAdId,
              actualDisplayName: u.actualDisplayName ?? "",
            }
          : {}),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Session error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
