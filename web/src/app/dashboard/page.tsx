"use client";

import { useSessionStore } from "@/store/sessionStore";
import { useIsAuthenticated } from "@azure/msal-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAccessToken } from "@/hooks/useAccessToken";
import { authenticatedFetch } from "@/lib/api/authenticatedFetch";
import {
  ReceivedInstructionsTable,
  type ReceivedInstructionListSortKey,
} from "@/components/instructions/ReceivedInstructionsTable";
import { DashboardConfirmLink } from "@/components/ui/dashboardConfirmLink";
import { ListPagination } from "@/components/ui/ListPagination";
import { ListSortTh, type ListSortDir } from "@/components/ui/ListSortTh";
import {
  formatListUpdatedAt,
  formatReportBusinessDateTime,
} from "@/lib/time/formatJa";
import type { DailyReport, DirectoryUser, WorkInstruction } from "@/types/models";
import {
  InstructionDocumentIcon,
  ReportDocumentIcon,
} from "@/components/ui/DocumentTypeIcons";
import { useSeenStore } from "@/store/seenStore";

const RECEIVED_REPORTS_PAGE = 10;
const RECEIVED_INSTRUCTIONS_PAGE = 5;

type DashReportSortKey = "author" | "date" | "updated";

function workStyleRank(s: WorkInstruction["workStyle"]): number {
  if (s === "office") return 0;
  if (s === "remote") return 1;
  if (s === "direct") return 2;
  return 9;
}

export default function DashboardPage() {
  const user = useSessionStore((s) => s.user);
  const sessionError = useSessionStore((s) => s.sessionError);
  const authed = useIsAuthenticated();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAccessToken();
  const byUserSeen = useSeenStore((s) => s.byUser);
  const setUserSeen = useSeenStore((s) => s.setUserSeen);
  const markReportSeen = useSeenStore((s) => s.markReportSeen);
  const markInstructionSeen = useSeenStore((s) => s.markInstructionSeen);
  const [receivedInstructions, setReceivedInstructions] = useState<
    WorkInstruction[]
  >([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [instrErr, setInstrErr] = useState<string | null>(null);
  const [reportErr, setReportErr] = useState<string | null>(null);
  const [reportPage, setReportPage] = useState(1);
  const [instructionPage, setInstructionPage] = useState(1);
  const [reportSortKey, setReportSortKey] =
    useState<DashReportSortKey>("updated");
  const [reportSortDir, setReportSortDir] = useState<ListSortDir>("desc");
  const [instrSortKey, setInstrSortKey] =
    useState<ReceivedInstructionListSortKey>("updated");
  const [instrSortDir, setInstrSortDir] = useState<ListSortDir>("desc");
  const [markAllReportsBusy, setMarkAllReportsBusy] = useState(false);
  const [markAllInstrBusy, setMarkAllInstrBusy] = useState(false);
  const [seenDebugJson, setSeenDebugJson] = useState<string | null>(null);
  const seenDebugEnabled = searchParams?.get("seenDebug") === "1";
  const [seenDebugActionResult, setSeenDebugActionResult] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!authed) router.replace("/login");
  }, [authed, router]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setInstrErr(null);
      setReportErr(null);
      try {
        const [insRes, repRes, dirRes, seenRes] = await Promise.all([
          authenticatedFetch(getToken, "/api/work-instructions"),
          authenticatedFetch(getToken, "/api/daily-reports"),
          authenticatedFetch(getToken, "/api/users"),
          authenticatedFetch(getToken, "/api/seen"),
        ]);
        const insData = await insRes.json();
        if (!insRes.ok) throw new Error(insData.error);
        const insItems = (insData.items ?? []) as WorkInstruction[];
        setReceivedInstructions(
          insItems.filter((w) => w.targetUserId === user.id)
        );

        const repData = await repRes.json();
        if (!repRes.ok) throw new Error(repData.error);
        setReports((repData.items ?? []) as DailyReport[]);

        const dirData = await dirRes.json();
        if (dirRes.ok) {
          setDirectory((dirData.items ?? []) as DirectoryUser[]);
        }

        const seenData = await seenRes.json().catch(() => ({}));
        if (seenRes.ok && seenData?.seen) {
          setUserSeen(user.id, seenData.seen);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "読み込みに失敗しました";
        setInstrErr(msg);
        setReportErr(msg);
      }
    })();
  }, [getToken, setUserSeen, user]);

  useEffect(() => {
    if (!user) return;
    if (!seenDebugEnabled) {
      setSeenDebugJson(null);
      setSeenDebugActionResult(null);
      return;
    }
    void (async () => {
      try {
        const res = await authenticatedFetch(getToken, "/api/seen?debug=1");
        const json = await res.json().catch(() => ({}));
        setSeenDebugJson(JSON.stringify(json, null, 2));
      } catch (e) {
        setSeenDebugJson(
          JSON.stringify(
            { error: e instanceof Error ? e.message : "debug fetch failed" },
            null,
            2
          )
        );
      }
    })();
  }, [getToken, seenDebugEnabled, user]);

  async function refreshSeenDebug() {
    try {
      const res = await authenticatedFetch(getToken, "/api/seen?debug=1");
      const json = await res.json().catch(() => ({}));
      setSeenDebugJson(JSON.stringify(json, null, 2));
    } catch (e) {
      setSeenDebugJson(
        JSON.stringify(
          { error: e instanceof Error ? e.message : "debug fetch failed" },
          null,
          2
        )
      );
    }
  }

  async function debugMarkAllInstructions() {
    if (!user) return;
    const ids = receivedInstructions.map((w) => w.id).filter(Boolean);
    const atMs = Date.now();
    try {
      const res = await authenticatedFetch(getToken, "/api/seen/mark-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "instruction", ids, atMs }),
      });
      const data = await res.json().catch(() => ({}));
      setSeenDebugActionResult(JSON.stringify({ status: res.status, data }, null, 2));
    } catch (e) {
      setSeenDebugActionResult(
        JSON.stringify(
          { error: e instanceof Error ? e.message : "mark-all failed" },
          null,
          2
        )
      );
    } finally {
      await refreshSeenDebug();
    }
  }

  useEffect(() => {
    setReportPage(1);
  }, [reports, user?.id, reportSortKey, reportSortDir]);

  useEffect(() => {
    setInstructionPage(1);
  }, [receivedInstructions, user?.id, instrSortKey, instrSortDir]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of directory) {
      m.set(d.id, d.displayName || d.email || d.id);
    }
    return m;
  }, [directory]);

  const seenForMe = useMemo(() => {
    const uid = (user?.id ?? "").trim().toLowerCase();
    return uid ? byUserSeen[uid] : undefined;
  }, [byUserSeen, user?.id]);

  const unseenInstructionIds = useMemo(() => {
    const m = new Set<string>();
    const seen = seenForMe?.instructions ?? {};
    for (const w of receivedInstructions) {
      const updatedMs = getItemUpdatedMs(w.createdAt, w.submittedAt);
      const seenAt = typeof seen[w.id] === "number" ? seen[w.id] : 0;
      if (updatedMs > 0 && seenAt < updatedMs) m.add(w.id);
      else if (updatedMs === 0 && !seen[w.id]) m.add(w.id);
    }
    return m;
  }, [receivedInstructions, seenForMe?.instructions]);

  function cycleReportSort(key: DashReportSortKey) {
    if (reportSortKey === key) {
      setReportSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setReportSortKey(key);
      setReportSortDir(key === "author" ? "asc" : "desc");
    }
  }

  function cycleInstrSort(key: ReceivedInstructionListSortKey) {
    if (instrSortKey === key) {
      setInstrSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setInstrSortKey(key);
      const descDefault =
        key === "targetDate" || key === "updated" || key === "workStyle";
      setInstrSortDir(
        key === "counterparty" ? "asc" : descDefault ? "desc" : "asc"
      );
    }
  }

  const submissionNotificationBase = useMemo(() => {
    if (!user) return [];
    return reports.filter(
      (r) =>
        r.submissionTargetId === user.id &&
        r.userId !== user.id &&
        r.submissionTargetId
    );
  }, [reports, user]);

  const unseenSubmissionReportIds = useMemo(() => {
    const m = new Set<string>();
    const seen = seenForMe?.reports ?? {};
    for (const r of submissionNotificationBase) {
      const updatedMs = getItemUpdatedMs(r.createdAt, r.submittedAt);
      const seenAt = typeof seen[r.id] === "number" ? seen[r.id] : 0;
      if (updatedMs > 0 && seenAt < updatedMs) m.add(r.id);
      else if (updatedMs === 0 && !seen[r.id]) m.add(r.id);
    }
    return m;
  }, [seenForMe?.reports, submissionNotificationBase]);

  const seenDebugCalc = useMemo(() => {
    if (!seenDebugEnabled || !user) return null;
    const uid = (user.id ?? "").trim().toLowerCase();
    const seen = (uid ? byUserSeen[uid]?.instructions : undefined) ?? {};
    const rows = receivedInstructions.slice(0, 15).map((w) => {
      const updatedMs = getItemUpdatedMs(w.createdAt, w.submittedAt);
      const seenAt = typeof seen[w.id] === "number" ? seen[w.id] : null;
      return {
        id: w.id,
        createdAt: w.createdAt ?? "",
        submittedAt: w.submittedAt ?? "",
        updatedMs,
        seenAt,
        unread:
          updatedMs > 0
            ? (seenAt ?? 0) < updatedMs
            : seenAt == null
              ? true
              : false,
      };
    });
    return { instructionRows: rows, instructionCount: receivedInstructions.length };
  }, [byUserSeen, receivedInstructions, seenDebugEnabled, user]);

  const sortedSubmissionReports = useMemo(() => {
    const list = [...submissionNotificationBase];
    const mult = reportSortDir === "asc" ? 1 : -1;
    const nm = (id: string) =>
      nameById.get(id) ?? "（ユーザー名未取得）";
    list.sort((a, b) => {
      let c = 0;
      switch (reportSortKey) {
        case "author":
          c = nm(a.userId).localeCompare(nm(b.userId), "ja");
          break;
        case "date":
          c = a.date.localeCompare(b.date);
          break;
        case "updated": {
          const pa = Date.parse(a.submittedAt || "");
          const pb = Date.parse(b.submittedAt || "");
          const fa = Number.isFinite(pa);
          const fb = Number.isFinite(pb);
          if (!fa && !fb) c = a.date.localeCompare(b.date);
          else if (!fa) c = 1;
          else if (!fb) c = -1;
          else if (pa !== pb) c = pa - pb;
          else c = a.date.localeCompare(b.date);
          break;
        }
        default:
          return 0;
      }
      return c * mult;
    });
    return list;
  }, [
    submissionNotificationBase,
    reportSortKey,
    reportSortDir,
    nameById,
  ]);

  const reportTotalPages = Math.max(
    1,
    Math.ceil(sortedSubmissionReports.length / RECEIVED_REPORTS_PAGE)
  );
  const safeReportPage = Math.min(Math.max(1, reportPage), reportTotalPages);
  const displayedSubmissionReports = useMemo(
    () =>
      sortedSubmissionReports.slice(
        (safeReportPage - 1) * RECEIVED_REPORTS_PAGE,
        safeReportPage * RECEIVED_REPORTS_PAGE
      ),
    [sortedSubmissionReports, safeReportPage]
  );

  const sortedReceivedInstructions = useMemo(() => {
    const list = [...receivedInstructions];
    const mult = instrSortDir === "asc" ? 1 : -1;
    const cpName = (w: WorkInstruction) =>
      nameById.get(w.adminId) ?? `${w.adminId.slice(0, 8)}…`;
    list.sort((a, b) => {
      let c = 0;
      switch (instrSortKey) {
        case "counterparty":
          c = cpName(a).localeCompare(cpName(b), "ja");
          break;
        case "workStyle":
          c = workStyleRank(a.workStyle) - workStyleRank(b.workStyle);
          break;
        case "targetDate":
          c = (a.targetDate || "").localeCompare(b.targetDate || "");
          break;
        case "updated": {
          const pa = Date.parse(a.submittedAt || "");
          const pb = Date.parse(b.submittedAt || "");
          const fa = Number.isFinite(pa);
          const fb = Number.isFinite(pb);
          if (!fa && !fb) {
            c = (a.targetDate || "").localeCompare(b.targetDate || "");
          } else if (!fa) c = 1;
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
  }, [receivedInstructions, instrSortKey, instrSortDir, nameById]);

  const instrTotalPages = Math.max(
    1,
    Math.ceil(sortedReceivedInstructions.length / RECEIVED_INSTRUCTIONS_PAGE)
  );
  const safeInstrPage = Math.min(Math.max(1, instructionPage), instrTotalPages);
  const displayedReceivedInstructions = useMemo(
    () =>
      sortedReceivedInstructions.slice(
        (safeInstrPage - 1) * RECEIVED_INSTRUCTIONS_PAGE,
        safeInstrPage * RECEIVED_INSTRUCTIONS_PAGE
      ),
    [sortedReceivedInstructions, safeInstrPage]
  );

  async function markAllReportsAsRead() {
    if (!user) return;
    const ids = submissionNotificationBase.map((r) => r.id).filter(Boolean);
    if (ids.length === 0) return;
    setMarkAllReportsBusy(true);
    setReportErr(null);
    const atMs = Date.now();
    try {
      const res = await authenticatedFetch(getToken, "/api/seen/mark-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "report", ids, atMs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "既読更新に失敗しました");
      for (const id of ids) markReportSeen(user.id, id, atMs);
    } catch (e) {
      setReportErr(e instanceof Error ? e.message : "既読更新に失敗しました");
    } finally {
      setMarkAllReportsBusy(false);
    }
  }

  async function markAllInstructionsAsRead() {
    if (!user) return;
    const ids = receivedInstructions.map((w) => w.id).filter(Boolean);
    if (ids.length === 0) return;
    setMarkAllInstrBusy(true);
    setInstrErr(null);
    const atMs = Date.now();
    try {
      const res = await authenticatedFetch(getToken, "/api/seen/mark-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "instruction", ids, atMs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "既読更新に失敗しました");
      for (const id of ids) markInstructionSeen(user.id, id, atMs);
    } catch (e) {
      setInstrErr(e instanceof Error ? e.message : "既読更新に失敗しました");
    } finally {
      setMarkAllInstrBusy(false);
    }
  }

  if (sessionError) {
    return (
      <div className="space-y-3 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-medium">セッションを取得できませんでした</p>
        <p className="whitespace-pre-wrap">{sessionError}</p>
        <p className="text-zinc-600">
          Microsoft でのサインインはできています。SharePoint のサイト ID・リスト ID、列名、API
          の管理者同意を確認してください。
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <p className="text-sm text-zinc-500">セッションを取得しています…</p>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-zinc-900">
        ようこそ、{user.displayName ?? "利用者"} さん
      </h1>

      {seenDebugJson ? (
        <section className="rounded border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700">
              seen debug（`/dashboard?seenDebug=1`）
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void refreshSeenDebug()}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                再読込
              </button>
              <button
                type="button"
                onClick={() => void debugMarkAllInstructions()}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                既読同期テスト（指示書）
              </button>
            </div>
          </div>
          {seenDebugActionResult ? (
            <pre className="mt-2 max-h-[240px] overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 text-[11px] text-slate-800">
              {seenDebugActionResult}
            </pre>
          ) : null}
          {seenDebugCalc ? (
            <pre className="mt-2 max-h-[240px] overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 text-[11px] text-slate-800">
              {JSON.stringify(seenDebugCalc, null, 2)}
            </pre>
          ) : null}
          <pre className="mt-2 max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 text-[11px] text-slate-800">
            {seenDebugJson}
          </pre>
        </section>
      ) : (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => router.push("/dashboard?seenDebug=1")}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            既読デバッグを表示
          </button>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <ReportDocumentIcon
              className="h-6 w-6 shrink-0 text-sky-600"
              aria-hidden
            />
            受信した業務報告書
            {unseenSubmissionReportIds.size > 0 ? (
              <span className="ml-2 rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">
                未読 {unseenSubmissionReportIds.size}
              </span>
            ) : null}
          </h2>
          <button
            type="button"
            onClick={() => void markAllReportsAsRead()}
            disabled={markAllReportsBusy || unseenSubmissionReportIds.size === 0}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            全て既読にする
          </button>
        </div>
        {reportErr && (
          <p className="text-sm text-red-600" role="alert">
            {reportErr}
          </p>
        )}
        {submissionNotificationBase.length === 0 ? (
          <p className="text-sm text-slate-500">
            受信した業務報告書はまだありません。
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              列見出しをクリックすると並び替えできます。
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="w-16 px-4 py-3 font-medium whitespace-nowrap">
                      状態
                    </th>
                    <ListSortTh
                      className="px-4 py-3"
                      label="記入者"
                      active={reportSortKey === "author"}
                      dir={reportSortDir}
                      onClick={() => cycleReportSort("author")}
                    />
                    <ListSortTh
                      className="px-4 py-3"
                      label="報告日"
                      active={reportSortKey === "date"}
                      dir={reportSortDir}
                      onClick={() => cycleReportSort("date")}
                    />
                    <ListSortTh
                      className="px-4 py-3"
                      label="更新日"
                      active={reportSortKey === "updated"}
                      dir={reportSortDir}
                      onClick={() => cycleReportSort("updated")}
                    />
                    <th className="w-28 px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {displayedSubmissionReports.map((r) => {
                    const author =
                      nameById.get(r.userId) ?? "（ユーザー名未取得）";
                    return (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="px-4 py-3">
                          {unseenSubmissionReportIds.has(r.id) ? (
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded bg-red-100 text-[12px] font-bold text-red-700"
                              aria-label="未読"
                              title="未読"
                            >
                              未
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {author}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-800">
                          {formatReportBusinessDateTime(r)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-800">
                          {formatListUpdatedAt(
                            r.createdAt ?? "",
                            r.submittedAt ?? ""
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <DashboardConfirmLink
                            href={`/reports/${r.id}/edit?notify=1`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={safeReportPage}
              pageSize={RECEIVED_REPORTS_PAGE}
              total={sortedSubmissionReports.length}
              onPageChange={setReportPage}
            />
          </>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <InstructionDocumentIcon
              className="h-6 w-6 shrink-0 text-amber-600"
              aria-hidden
            />
            受信した業務指示書
            {unseenInstructionIds.size > 0 ? (
              <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                未読 {unseenInstructionIds.size}
              </span>
            ) : null}
          </h2>
          <button
            type="button"
            onClick={() => void markAllInstructionsAsRead()}
            disabled={markAllInstrBusy || unseenInstructionIds.size === 0}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            全て既読にする
          </button>
        </div>
        {instrErr && (
          <p className="text-sm text-red-600" role="alert">
            {instrErr}
          </p>
        )}
        {receivedInstructions.length === 0 ? (
          <p className="text-sm text-slate-500">
            受信した業務指示書はまだありません。
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              列見出しをクリックすると並び替えできます。
            </p>
            <ReceivedInstructionsTable
              items={displayedReceivedInstructions}
              unseenIds={unseenInstructionIds}
              nameById={nameById}
              counterpartyLabel="指示者"
              counterpartyId={(w) => w.adminId}
              sortHeader={{
                activeKey: instrSortKey,
                dir: instrSortDir,
                onColumnClick: cycleInstrSort,
              }}
            />
            <ListPagination
              page={safeInstrPage}
              pageSize={RECEIVED_INSTRUCTIONS_PAGE}
              total={sortedReceivedInstructions.length}
              onPageChange={setInstructionPage}
            />
          </>
        )}
      </section>
    </div>
  );
}

function getItemUpdatedMs(createdAt?: string, submittedAt?: string): number {
  const s = Date.parse((submittedAt ?? "").trim());
  if (Number.isFinite(s)) return s;
  const c = Date.parse((createdAt ?? "").trim());
  if (Number.isFinite(c)) return c;
  return 0;
}
