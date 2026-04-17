"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import { useAccessToken } from "@/hooks/useAccessToken";
import { useSessionStore } from "@/store/sessionStore";
import { authenticatedFetch } from "@/lib/api/authenticatedFetch";
import {
  formatListUpdatedAt,
  formatReportBusinessDateTime,
} from "@/lib/time/formatJa";
import type { DailyReport, DirectoryUser } from "@/types/models";
import { ReportDocumentIcon } from "@/components/ui/DocumentTypeIcons";
import { DashboardConfirmLink } from "@/components/ui/dashboardConfirmLink";
import { ListPagination } from "@/components/ui/ListPagination";
import { ListSortTh, type ListSortDir } from "@/components/ui/ListSortTh";
import { formatReportNumber } from "@/lib/serial/documentNumber";

const LIST_PAGE_SIZE = 20;

type SortDir = ListSortDir;
type ReportSortKey = "number" | "author" | "target" | "date" | "updated";

const deleteBtnClass =
  "rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100";

export default function ReportsListPage() {
  const authed = useIsAuthenticated();
  const { getToken } = useAccessToken();
  const user = useSessionStore((s) => s.user);
  const router = useRouter();
  const [items, setItems] = useState<DailyReport[]>([]);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<ReportSortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!authed) router.replace("/login");
  }, [authed, router]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const [repRes, dirRes] = await Promise.all([
          authenticatedFetch(getToken, "/api/daily-reports"),
          authenticatedFetch(getToken, "/api/users"),
        ]);
        const data = await repRes.json();
        if (!repRes.ok) throw new Error(data.error);
        setItems(data.items ?? []);
        const dirJson = await dirRes.json();
        if (dirRes.ok) {
          setDirectory((dirJson.items ?? []) as DirectoryUser[]);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "読み込み失敗");
      }
    })();
  }, [getToken, user]);

  useEffect(() => {
    setPage(1);
  }, [items, sortKey, sortDir]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of directory) {
      m.set(d.id, d.displayName || d.email || d.id);
    }
    return m;
  }, [directory]);

  function cycleSort(key: ReportSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      const descDefault = key === "date" || key === "updated";
      setSortDir(descDefault ? "desc" : "asc");
    }
  }

  const sortedItems = useMemo(() => {
    const list = [...items];
    const mult = sortDir === "asc" ? 1 : -1;
    const nm = (id: string) => nameById.get(id) ?? id;
    const parseSortableId = (id: string): { n?: number; s: string } => {
      const s = String(id ?? "").trim();
      const n = Number.parseInt(s, 10);
      return Number.isFinite(n) ? { n, s } : { s };
    };
    list.sort((a, b) => {
      let c = 0;
      switch (sortKey) {
        case "number": {
          const pa = parseSortableId(a.id);
          const pb = parseSortableId(b.id);
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
        case "author":
          c = nm(a.userId).localeCompare(nm(b.userId), "ja");
          break;
        case "target":
          c = nm(a.submissionTargetId).localeCompare(
            nm(b.submissionTargetId),
            "ja"
          );
          break;
        case "date":
          c = a.date.localeCompare(b.date);
          break;
        case "updated": {
          const pa = Date.parse(a.submittedAt || "");
          const pb = Date.parse(b.submittedAt || "");
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
  }, [items, sortKey, sortDir, nameById]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / LIST_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const displayedItems = useMemo(
    () =>
      sortedItems.slice(
        (safePage - 1) * LIST_PAGE_SIZE,
        safePage * LIST_PAGE_SIZE
      ),
    [sortedItems, safePage]
  );

  async function deleteReport(id: string) {
    if (
      !confirm(
        "この業務報告書を削除しますか？SharePoint のリストからも削除され、元に戻せません。"
      )
    ) {
      return;
    }
    setErr(null);
    try {
      const res = await authenticatedFetch(
        getToken,
        `/api/daily-reports/${id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "削除に失敗しました");
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "削除に失敗しました");
    }
  }

  if (!user)
    return <p className="text-sm text-zinc-500">読み込み中…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <ReportDocumentIcon
            className="h-7 w-7 shrink-0 text-sky-600"
            aria-hidden
          />
          業務報告書
        </h1>
        <Link
          href="/reports/new"
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white"
        >
          新規作成
        </Link>
      </div>
      <p className="text-xs text-zinc-500">
        1ページあたり {LIST_PAGE_SIZE}{" "}
        件です。◀ ▶ でページを切り替えられます。列見出しで並び替えができます。
      </p>
      {err && <p className="text-sm text-red-600">{err}</p>}
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
                label="記入者"
                active={sortKey === "author"}
                dir={sortDir}
                onClick={() => cycleSort("author")}
              />
              <ListSortTh
                label="提出先"
                active={sortKey === "target"}
                dir={sortDir}
                onClick={() => cycleSort("target")}
              />
              <ListSortTh
                label="報告日"
                active={sortKey === "date"}
                dir={sortDir}
                onClick={() => cycleSort("date")}
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
            {displayedItems.map((r) => {
              const authorName =
                nameById.get(r.userId) ?? `${r.userId.slice(0, 8)}…`;
              const targetName =
                nameById.get(r.submissionTargetId) ??
                `${r.submissionTargetId.slice(0, 8)}…`;
              return (
                <tr key={r.id} className="border-b border-zinc-100">
                  <td className="px-3 py-2 tabular-nums font-medium text-zinc-900">
                    {formatReportNumber(r.id)}
                  </td>
                  <td className="px-3 py-2 text-sm">{authorName}</td>
                  <td className="px-3 py-2 text-sm">{targetName}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatReportBusinessDateTime(r)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatListUpdatedAt(r.createdAt ?? "", r.submittedAt ?? "")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <DashboardConfirmLink href={`/reports/${r.id}/edit`} />
                      <button
                        type="button"
                        className={deleteBtnClass}
                        onClick={() => void deleteReport(r.id)}
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
        {items.length === 0 && (
          <p className="p-4 text-sm text-zinc-500">
            業務報告書はまだありません。
          </p>
        )}
      </div>
      <ListPagination
        page={safePage}
        pageSize={LIST_PAGE_SIZE}
        total={sortedItems.length}
        onPageChange={setPage}
      />
    </div>
  );
}
