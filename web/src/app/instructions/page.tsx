"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import { useAccessToken } from "@/hooks/useAccessToken";
import { useSessionStore } from "@/store/sessionStore";
import { authenticatedFetch } from "@/lib/api/authenticatedFetch";
import { formatListUpdatedAt, formatSlashDate, formatSlashDateTime } from "@/lib/time/formatJa";
import type { DirectoryUser, WorkInstruction } from "@/types/models";
import { InstructionDocumentIcon } from "@/components/ui/DocumentTypeIcons";
import { DashboardConfirmLink } from "@/components/ui/dashboardConfirmLink";
import { ListPagination } from "@/components/ui/ListPagination";
import { ListSortTh, type ListSortDir } from "@/components/ui/ListSortTh";
import { formatInstructionNumber } from "@/lib/serial/documentNumber";

const LIST_PAGE_SIZE = 20;

type SortDir = ListSortDir;
type InstrSortKey =
  | "number"
  | "admin"
  | "targetUser"
  | "instructionDate"
  | "targetDate"
  | "updated";

const deleteBtnClass =
  "rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100";

export default function InstructionsListPage() {
  const authed = useIsAuthenticated();
  const { getToken } = useAccessToken();
  const user = useSessionStore((s) => s.user);
  const router = useRouter();
  const [all, setAll] = useState<WorkInstruction[]>([]);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<InstrSortKey>("number");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!authed) router.replace("/login");
  }, [authed, router]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setErr(null);
      try {
        const [wRes, dRes] = await Promise.all([
          authenticatedFetch(getToken, "/api/work-instructions"),
          authenticatedFetch(getToken, "/api/users"),
        ]);
        const wJson = await wRes.json();
        if (!wRes.ok) throw new Error(wJson.error);
        setAll((wJson.items ?? []) as WorkInstruction[]);
        const dJson = await dRes.json();
        if (dRes.ok) {
          setDirectory((dJson.items ?? []) as DirectoryUser[]);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "読み込み失敗");
      }
    })();
  }, [getToken, user]);

  useEffect(() => {
    setPage(1);
  }, [all, sortKey, sortDir]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of directory) {
      m.set(d.id, d.displayName || d.email || d.id);
    }
    return m;
  }, [directory]);

  function cycleSort(key: InstrSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      const descDefault =
        key === "instructionDate" || key === "targetDate" || key === "updated";
      setSortDir(
        key === "number" || key === "admin" || key === "targetUser"
          ? "asc"
          : descDefault
            ? "desc"
            : "asc"
      );
    }
  }

  const rowData = useMemo(() => {
    if (!user) return [];
    return all.map((w) => {
      const authorName =
        nameById.get(w.adminId) ?? `${w.adminId.slice(0, 8)}…`;
      const targetName =
        nameById.get(w.targetUserId) ?? `${w.targetUserId.slice(0, 8)}…`;
      return { w, authorName, targetName };
    });
  }, [all, user, nameById]);

  const sortedRows = useMemo(() => {
    const list = [...rowData];
    const mult = sortDir === "asc" ? 1 : -1;
    const parseSortableId = (id: string): { n?: number; s: string } => {
      const s = String(id ?? "").trim();
      const n = Number.parseInt(s, 10);
      return Number.isFinite(n) ? { n, s } : { s };
    };
    list.sort((a, b) => {
      let c = 0;
      switch (sortKey) {
        case "number": {
          const pa = parseSortableId(a.w.id);
          const pb = parseSortableId(b.w.id);
          if (typeof pa.n === "number" && typeof pb.n === "number") {
            c = pa.n - pb.n;
          } else if (typeof pa.n === "number") {
            c = -1;
          } else if (typeof pb.n === "number") {
            c = 1;
          } else {
            c = pa.s.localeCompare(pb.s, "ja");
          }
          break;
        }
        case "admin":
          c = a.authorName.localeCompare(b.authorName, "ja");
          break;
        case "targetUser":
          c = a.targetName.localeCompare(b.targetName, "ja");
          break;
        case "instructionDate": {
          const pa = Date.parse(a.w.createdAt || "");
          const pb = Date.parse(b.w.createdAt || "");
          const fa = Number.isFinite(pa);
          const fb = Number.isFinite(pb);
          if (!fa && !fb) c = 0;
          else if (!fa) c = 1;
          else if (!fb) c = -1;
          else c = pa - pb;
          break;
        }
        case "targetDate":
          c = (a.w.targetDate || "").localeCompare(b.w.targetDate || "");
          break;
        case "updated": {
          const pa = Date.parse(a.w.submittedAt || "");
          const pb = Date.parse(b.w.submittedAt || "");
          const fa = Number.isFinite(pa);
          const fb = Number.isFinite(pb);
          if (!fa && !fb) c = 0;
          else if (!fa) c = 1;
          else if (!fb) c = -1;
          else c = pa - pb;
          break;
        }
        default:
          return 0;
      }
      return c * mult;
    });
    return list;
  }, [rowData, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / LIST_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const displayedRows = useMemo(
    () =>
      sortedRows.slice(
        (safePage - 1) * LIST_PAGE_SIZE,
        safePage * LIST_PAGE_SIZE
      ),
    [sortedRows, safePage]
  );

  async function deleteInstruction(id: string) {
    if (
      !confirm(
        "この業務指示書を削除しますか？SharePoint のリストからも削除され、元に戻せません。"
      )
    ) {
      return;
    }
    setErr(null);
    try {
      const res = await authenticatedFetch(
        getToken,
        `/api/work-instructions/${id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "削除に失敗しました");
      setAll((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "削除に失敗しました");
    }
  }

  if (!user) {
    return <p className="text-sm text-slate-500">読み込み中…</p>;
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-900">
          <InstructionDocumentIcon
            className="h-7 w-7 shrink-0 text-amber-600"
            aria-hidden
          />
          業務指示書
        </h1>
        <Link
          href="/instructions/new"
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white"
        >
          新規作成
        </Link>
      </div>

      <p className="text-xs text-zinc-500">
        1ページあたり {LIST_PAGE_SIZE}{" "}
        件です。◀ ▶ でページを切り替えられます。列見出しで並び替えができます。
      </p>

      {err && (
        <p className="text-sm text-red-600" role="alert">
          {err}
        </p>
      )}

      <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-zinc-50 text-zinc-600">
            <tr>
              <ListSortTh
                label="番号"
                active={sortKey === "number"}
                dir={sortDir}
                onClick={() => cycleSort("number")}
              />
              <ListSortTh
                label="指示者"
                active={sortKey === "admin"}
                dir={sortDir}
                onClick={() => cycleSort("admin")}
              />
              <ListSortTh
                label="対象者"
                active={sortKey === "targetUser"}
                dir={sortDir}
                onClick={() => cycleSort("targetUser")}
              />
              <ListSortTh
                label="対象日"
                active={sortKey === "targetDate"}
                dir={sortDir}
                onClick={() => cycleSort("targetDate")}
              />
              <ListSortTh
                label="指示日"
                active={sortKey === "instructionDate"}
                dir={sortDir}
                onClick={() => cycleSort("instructionDate")}
              />
              <ListSortTh
                label="更新日"
                active={sortKey === "updated"}
                dir={sortDir}
                onClick={() => cycleSort("updated")}
              />
              <th className="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.map(({ w, authorName, targetName }) => {
              return (
                <tr key={w.id} className="border-b border-zinc-100">
                  <td className="px-3 py-2 tabular-nums font-medium text-zinc-900">
                    {formatInstructionNumber(w.id)}
                  </td>
                  <td className="px-3 py-2 text-sm">{authorName}</td>
                  <td className="px-3 py-2 text-sm">{targetName}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatSlashDate(w.targetDate || "")}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatSlashDateTime(w.createdAt || "")}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatListUpdatedAt(w.createdAt ?? "", w.submittedAt ?? "")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <DashboardConfirmLink
                        href={`/instructions/${w.id}/edit`}
                      />
                      <button
                        type="button"
                        className={deleteBtnClass}
                        onClick={() => void deleteInstruction(w.id)}
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sortedRows.length === 0 && (
          <p className="p-4 text-sm text-zinc-500">
            業務指示書はまだありません。
          </p>
        )}
      </div>
      <ListPagination
        page={safePage}
        pageSize={LIST_PAGE_SIZE}
        total={sortedRows.length}
        onPageChange={setPage}
      />
    </div>
  );
}
