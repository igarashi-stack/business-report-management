"use client";

import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { usePathname, useRouter } from "next/navigation";
import { useAccessToken } from "@/hooks/useAccessToken";
import { useSessionStore } from "@/store/sessionStore";
import { authenticatedFetch } from "@/lib/api/authenticatedFetch";
import { useEffect, useRef } from "react";

/** ログイン済みでセッション未取得なら /api/session でロールを同期 */
export function SessionLoader() {
  const authed = useIsAuthenticated();
  const { inProgress } = useMsal();
  const pathname = usePathname();
  const router = useRouter();
  const { getToken } = useAccessToken();
  const impersonateUserId = useSessionStore((s) => s.impersonateUserId);
  const { user, setUser, setSessionError, setDevImpersonation } =
    useSessionStore();
  const setCanImpersonate = useSessionStore((s) => s.setCanImpersonate);
  const loadingRef = useRef(false);

  /** 直接 URL で /dev 等に入ったとき、MSAL 未ログインなら /login へ（getToken が常に null になるのを防ぐ） */
  useEffect(() => {
    if (
      inProgress === InteractionStatus.Startup ||
      inProgress === InteractionStatus.HandleRedirect
    ) {
      return;
    }
    if (authed || pathname === "/login") return;
    useSessionStore.getState().setUser(null);
    useSessionStore.getState().setSessionError(null);
    router.replace("/login");
  }, [authed, inProgress, pathname, router]);

  useEffect(() => {
    if (
      inProgress === InteractionStatus.Startup ||
      inProgress === InteractionStatus.HandleRedirect
    ) {
      return;
    }
    if (!authed || pathname === "/login") return;
    if (user) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    void (async () => {
      try {
        const res = await authenticatedFetch(getToken, "/api/session");
        const data = await res.json();
        if (res.status === 401) {
          setSessionError(null);
          router.replace("/login");
          return;
        }
        if (!res.ok) {
          setSessionError(
            typeof data.error === "string"
              ? data.error
              : "サーバーでセッションを取得できませんでした（SharePoint 設定や権限を確認してください）"
          );
          return;
        }
        setSessionError(null);
        setUser(data.user);
        setCanImpersonate(Boolean(data.dev?.canImpersonate));
        if (data.dev?.impersonating && data.dev.actualUserId) {
          setDevImpersonation({
            actualUserId: data.dev.actualUserId,
            actualDisplayName:
              typeof data.dev.actualDisplayName === "string"
                ? data.dev.actualDisplayName
                : undefined,
          });
        } else {
          setDevImpersonation(null);
        }
      } catch {
        setSessionError(
          "ネットワークエラー、または認証の有効期限切れです。ページを再読み込みするか、再度サインインしてください。"
        );
      } finally {
        loadingRef.current = false;
      }
    })();
  }, [
    authed,
    inProgress,
    getToken,
    pathname,
    router,
    setUser,
    setSessionError,
    setDevImpersonation,
    setCanImpersonate,
    user,
    impersonateUserId,
  ]);

  return null;
}
