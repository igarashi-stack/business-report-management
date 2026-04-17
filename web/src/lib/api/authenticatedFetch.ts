import {
  clientMaySendImpersonationHeader,
  DEV_IMPERSONATE_HEADER,
} from "@/lib/dev/impersonation";
import { useSessionStore } from "@/store/sessionStore";

export async function authenticatedFetch(
  getToken: () => Promise<string | null>,
  input: RequestInfo | URL,
  init?: RequestInit
) {
  const token = await getToken();
  if (!token) throw new Error("未ログインです");
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (clientMaySendImpersonationHeader()) {
    if (!useSessionStore.getState().canImpersonate) {
      return fetch(input, { ...init, headers });
    }
    const imp = useSessionStore.getState().impersonateUserId?.trim();
    if (imp) headers.set(DEV_IMPERSONATE_HEADER, imp);
  }
  return fetch(input, { ...init, headers });
}
