"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import { useAccessToken } from "@/hooks/useAccessToken";
import { useSessionStore } from "@/store/sessionStore";
import { authenticatedFetch } from "@/lib/api/authenticatedFetch";
import { useDirectoryVisibilityStore } from "@/store/directoryVisibilityStore";
import type { DirectoryUser } from "@/types/models";

export default function EmployeesPage() {
  const authed = useIsAuthenticated();
  const router = useRouter();
  const { getToken } = useAccessToken();
  const user = useSessionStore((s) => s.user);
  const [items, setItems] = useState<DirectoryUser[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const mode = useDirectoryVisibilityStore((s) => s.mode);
  const pinnedVisibleUserIds = useDirectoryVisibilityStore(
    (s) => s.pinnedVisibleUserIds
  );
  const togglePinnedVisible = useDirectoryVisibilityStore(
    (s) => s.togglePinnedVisible
  );
  const showAll = useDirectoryVisibilityStore((s) => s.showAll);
  const clearAllSelected = useDirectoryVisibilityStore(
    (s) => s.clearAllSelected
  );

  const allIds = useMemo(() => items.map((u) => u.id), [items]);

  useEffect(() => {
    if (!authed) router.replace("/login");
  }, [authed, router]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setErr(null);
      try {
        const res = await authenticatedFetch(getToken, "/api/users");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setItems((data.items ?? []) as DirectoryUser[]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "読み込み失敗");
      }
    })();
  }, [getToken, user]);

  if (!user) {
    return <p className="text-sm text-slate-500">読み込み中…</p>;
  }

  const restrictionOn = mode === "custom";

  return (
    <div className="space-y-6 pb-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          従業員一覧
        </h1>
      </header>

      {err && (
        <p className="text-sm text-red-600" role="alert">
          {err}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => showAll()}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          表示制限を解除（全員を表示）
        </button>
        <button
          type="button"
          onClick={() => clearAllSelected()}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          全ての選択を解除
        </button>
        <span className="text-xs text-slate-500">
          {restrictionOn
            ? `プルダウン表示: ${pinnedVisibleUserIds.length} 名`
            : "プルダウン: 制限なし（全員）"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="w-12 px-4 py-3 font-medium">表示</th>
              <th className="px-4 py-3 font-medium">表示名</th>
              <th className="px-4 py-3 font-medium">メール</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => {
              const inDropdown =
                mode === "all" || pinnedVisibleUserIds.includes(u.id);
              return (
                <tr
                  key={u.id}
                  className={`border-b border-slate-100 ${!inDropdown ? "bg-slate-50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={inDropdown}
                      onChange={() => togglePinnedVisible(u.id, allIds)}
                      aria-label={`${u.displayName || u.email} をプルダウンに表示`}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {u.displayName || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{u.email || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
