"use client";

import { useEffect, useState } from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import { useAccessToken } from "@/hooks/useAccessToken";
import { authenticatedFetch } from "@/lib/api/authenticatedFetch";
import { clientMaySendImpersonationHeader } from "@/lib/dev/impersonation";
import { useSessionStore } from "@/store/sessionStore";

type DirUser = { id: string; displayName: string; email: string };

export function DevImpersonationBar() {
  const msalAuthed = useIsAuthenticated();
  const { getToken } = useAccessToken();
  const user = useSessionStore((s) => s.user);
  const devImpersonation = useSessionStore((s) => s.devImpersonation);
  const canImpersonate = useSessionStore((s) => s.canImpersonate);
  const impersonateUserId = useSessionStore((s) => s.impersonateUserId);
  const setImpersonateUserId = useSessionStore((s) => s.setImpersonateUserId);
  const setUser = useSessionStore((s) => s.setUser);
  const [users, setUsers] = useState<DirUser[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const allowed = clientMaySendImpersonationHeader() && canImpersonate;

  useEffect(() => {
    if (!allowed || !msalAuthed) return;
    void (async () => {
      try {
        const res = await authenticatedFetch(getToken, "/api/users");
        if (!res.ok) {
          setLoadErr("ユーザー一覧を取得できませんでした");
          return;
        }
        const data: { items?: DirUser[] } = await res.json();
        setUsers(Array.isArray(data.items) ? data.items : []);
        setLoadErr(null);
      } catch {
        setLoadErr("ユーザー一覧を取得できませんでした");
      }
    })();
  }, [allowed, msalAuthed, getToken]);

  if (!allowed) return null;

  function applyImpersonation(nextId: string | null) {
    setImpersonateUserId(nextId);
    setUser(null);
  }

  const actualLabel =
    devImpersonation?.actualDisplayName?.trim() ||
    devImpersonation?.actualUserId ||
    "";

  return (
    <>
      {devImpersonation && user && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          <span className="font-medium">検証モード</span>
          ：アプリ上は「{user.displayName ?? user.id}」として表示・保存されます。
          Microsoft Graph / SharePoint の権限は実ログイン
          {actualLabel ? `（${actualLabel}）` : ""}のままです。
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-b border-dashed border-zinc-300 bg-zinc-100 px-4 py-2 text-xs text-zinc-700">
        <span className="font-medium text-zinc-600">開発用 ユーザー差し替え</span>
        <select
          className="max-w-[min(24rem,100%)] rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900"
          value={impersonateUserId ?? ""}
          onChange={(e) => {
            const v = e.target.value.trim();
            applyImpersonation(v || null);
          }}
        >
          <option value="">本人（差し替えなし）</option>
          {(msalAuthed ? users : []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName || u.email || u.id.slice(0, 8) + "…"}
            </option>
          ))}
        </select>
        {impersonateUserId ? (
          <button
            type="button"
            className="rounded border border-zinc-400 px-2 py-1 hover:bg-zinc-200"
            onClick={() => applyImpersonation(null)}
          >
            解除
          </button>
        ) : null}
        {!msalAuthed ? (
          <span className="text-amber-800">
            Microsoft でサインインするとユーザー一覧を読み込みます
          </span>
        ) : loadErr ? (
          <span className="text-red-600">{loadErr}</span>
        ) : null}
      </div>
    </>
  );
}
