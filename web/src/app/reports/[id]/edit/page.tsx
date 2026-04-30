"use client";

import { DailyReportForm } from "@/components/reports/DailyReportForm";
import type { DailyReportFormValues } from "@/components/reports/DailyReportForm";
import { useAccessToken } from "@/hooks/useAccessToken";
import { authenticatedFetch } from "@/lib/api/authenticatedFetch";
import { useRouter, useParams } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import { useSessionStore } from "@/store/sessionStore";
import { useEffect, useMemo, useState } from "react";
import {
  fallbackUserOption,
  filterVisibleUsers,
  mergeUserIfMissing,
} from "@/lib/directory/filterVisibleUsers";
import { useDirectoryVisibilityStore } from "@/store/directoryVisibilityStore";
import { SecondaryButton } from "@/components/ui/FormPrimitives";
import type { DailyReport, DirectoryUser } from "@/types/models";
import { ReportDocumentIcon } from "@/components/ui/DocumentTypeIcons";
import { useSeenStore } from "@/store/seenStore";
import { useHandheldLines } from "@/hooks/useHandheldLines";
import { handheldSnapshotForReport } from "@/lib/storage/handheldProjects";
import { ReportsSubNav } from "@/components/reports/ReportsSubNav";

export default function EditReportPage() {
  const visibilityMode = useDirectoryVisibilityStore((s) => s.mode);
  const pinnedVisibleUserIds = useDirectoryVisibilityStore(
    (s) => s.pinnedVisibleUserIds
  );
  const params = useParams();
  const id = params.id as string;
  const authed = useIsAuthenticated();
  const { getToken } = useAccessToken();
  const user = useSessionStore((s) => s.user);
  const { lines: handheldLines } = useHandheldLines(user?.id);
  const markReportSeen = useSeenStore((s) => s.markReportSeen);
  const router = useRouter();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [userOptions, setUserOptions] = useState<DirectoryUser[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authed) router.replace("/login");
  }, [authed, router]);

  useEffect(() => {
    if (!id || !user) return;
    void (async () => {
      try {
        const res = await authenticatedFetch(getToken, `/api/daily-reports/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setReport(data.item);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "読み込み失敗");
      }
    })();
  }, [getToken, id, user]);

  // 閲覧（編集画面を開いた）= 既読扱い
  useEffect(() => {
    if (!user?.id || !id) return;
    markReportSeen(user.id, id);
    void (async () => {
      try {
        await authenticatedFetch(getToken, "/api/seen/mark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "report", id }),
        });
      } catch {
        // 既読同期の失敗は致命的ではないため握りつぶす
      }
    })();
  }, [getToken, id, markReportSeen, user?.id]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const uRes = await authenticatedFetch(getToken, "/api/users");
      const uData = await uRes.json();
      if (uRes.ok) {
        setUserOptions((uData.items ?? []) as DirectoryUser[]);
      }
    })();
  }, [getToken, user]);

  const mergedUserOptions = useMemo(() => {
    const base = filterVisibleUsers(
      userOptions,
      visibilityMode,
      pinnedVisibleUserIds
    );
    const withTarget = mergeUserIfMissing(
      base,
      report?.submissionTargetId,
      (id) =>
        fallbackUserOption(id, `提出先 (${id.slice(0, 8)}…)`)
    );
    return mergeUserIfMissing(
      withTarget,
      report?.userId,
      (id) => fallbackUserOption(id, `記入者 (${id.slice(0, 8)}…)`)
    );
  }, [
    userOptions,
    visibilityMode,
    pinnedVisibleUserIds,
    report?.submissionTargetId,
    report?.userId,
  ]);

  const authorDisplayName = useMemo(() => {
    if (!report || !user) return "";
    if (report.userId === user.id) return user.displayName ?? "";
    return (
      mergedUserOptions.find((u) => u.id === report.userId)?.displayName ?? ""
    );
  }, [report, user, mergedUserOptions]);

  async function save(values: DailyReportFormValues) {
    if (!report) return;
    setBusy(true);
    try {
      const res = await authenticatedFetch(getToken, `/api/daily-reports/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          date: values.date,
          weekday: values.weekday,
          workStyle: values.workStyle,
          clockInTime: values.clockInTime,
          clockOutTime: values.clockOutTime,
          breakDurationHours: values.breakDurationHours,
          submissionTargetId: values.submissionTargetId,
          totalWorkTime: values.totalWorkTime,
          tasks: values.tasks,
          currentProjectLines: handheldSnapshotForReport(handheldLines),
          tomorrowLines: values.tomorrowLines,
          summary: values.summary,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReport(data.item);
    } finally {
      setBusy(false);
    }
  }

  if (!user)
    return <p className="text-sm text-zinc-500">読み込み中…</p>;
  if (err)
    return <p className="text-sm text-red-600">{err}</p>;
  if (!report)
    return <p className="text-sm text-zinc-500">読み込み中…</p>;

  const isAuthor = report.userId === user.id;
  const hasTomorrowPlan =
    Array.isArray(report.tomorrowLines) &&
    report.tomorrowLines.some(
      (l) =>
        Boolean(l?.projectNumber?.trim()) ||
        Boolean(l?.projectName?.trim()) ||
        Boolean(l?.content?.trim())
    );
  const canCreateInstructionFromReport = Boolean(report.userId) && hasTomorrowPlan;

  async function handleDeleteReport() {
    if (
      !confirm(
        "この業務報告書を削除しますか？SharePoint のリストからも削除され、元に戻せません。"
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await authenticatedFetch(getToken, `/api/daily-reports/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "削除に失敗しました");
      router.push("/reports");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col gap-3">
        <ReportsSubNav />
        <div className="flex gap-3">
          <ReportDocumentIcon
            className="mt-1 h-8 w-8 shrink-0 text-sky-600"
            aria-hidden
          />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              業務報告書の編集
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {isAuthor
                ? "内容を更新したら「更新」を押してください。"
                : "提出先として内容を確認・更新できます。更新すると SharePoint の同じ項目が保存されます。"}
            </p>
          </div>
        </div>
      </header>
      <DailyReportForm
        key={`${report.id}-${report.submissionTargetId ?? ""}`}
        initial={report}
        onSubmit={save}
        submitting={busy}
        userOptions={mergedUserOptions}
        authorDisplayName={authorDisplayName}
        handheldLines={handheldLines}
        submitLabel="更新"
        formActionsExtra={
          <>
            <SecondaryButton
              onClick={() => router.push(`/reports/new?duplicateFrom=${id}`)}
            >
              複製
            </SecondaryButton>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleDeleteReport()}
              className="inline-flex min-h-[42px] items-center justify-center rounded-lg border border-red-200 bg-white px-5 text-sm font-medium text-red-800 shadow-sm transition hover:bg-red-50 disabled:opacity-50"
            >
              削除
            </button>
          </>
        }
      />
      {canCreateInstructionFromReport ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50/90 p-4 shadow-sm">
          <p className="text-sm text-slate-800">
            この報告書の「明日の作業予定」を業務内容に取り込み、業務指示書の新規作成画面を開きます。
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/instructions/new?fromReport=${encodeURIComponent(id)}`
                )
              }
              className="inline-flex min-h-[42px] min-w-[120px] items-center justify-center rounded-lg bg-amber-600 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700"
            >
              この報告書をもとに業務指示書を作成する
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
