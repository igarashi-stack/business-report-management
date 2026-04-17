"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { DailyReportForm } from "@/components/reports/DailyReportForm";
import type { DailyReportFormValues } from "@/components/reports/DailyReportForm";
import { useAccessToken } from "@/hooks/useAccessToken";
import { authenticatedFetch } from "@/lib/api/authenticatedFetch";
import { seedDailyReportFromDuplicate } from "@/lib/form/duplicateSeed";
import { useRouter, useSearchParams } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import { useSessionStore } from "@/store/sessionStore";
import { filterVisibleUsers } from "@/lib/directory/filterVisibleUsers";
import { useDirectoryVisibilityStore } from "@/store/directoryVisibilityStore";
import type { DailyReport, DirectoryUser } from "@/types/models";
import { ReportDocumentIcon } from "@/components/ui/DocumentTypeIcons";
import { SubmitSuccessOverlay } from "@/components/ui/SubmitSuccessOverlay";

function NewReportPageContent() {
  const searchParams = useSearchParams();
  const duplicateFrom = searchParams.get("duplicateFrom");

  const visibilityMode = useDirectoryVisibilityStore((s) => s.mode);
  const pinnedVisibleUserIds = useDirectoryVisibilityStore(
    (s) => s.pinnedVisibleUserIds
  );
  const authed = useIsAuthenticated();
  const { getToken } = useAccessToken();
  const user = useSessionStore((s) => s.user);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [userOptions, setUserOptions] = useState<DirectoryUser[]>([]);
  const [dupSeed, setDupSeed] = useState<Partial<DailyReport> | null>(null);
  const [dupErr, setDupErr] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdReportId, setCreatedReportId] = useState<string | null>(null);

  useEffect(() => {
    if (!authed) router.replace("/login");
  }, [authed, router]);

  useEffect(() => {
    if (!successMessage || !createdReportId) return;
    const t = window.setTimeout(() => {
      router.push(`/reports/${createdReportId}/edit`);
    }, 2600);
    return () => window.clearTimeout(t);
  }, [successMessage, createdReportId, router]);

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

  useEffect(() => {
    if (!duplicateFrom || !user) {
      setDupSeed(null);
      setDupErr(null);
      return;
    }
    let cancelled = false;
    setDupErr(null);
    void (async () => {
      try {
        const res = await authenticatedFetch(
          getToken,
          `/api/daily-reports/${duplicateFrom}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const item = data.item as DailyReport;
        if (!cancelled) {
          setDupSeed(seedDailyReportFromDuplicate(item));
        }
      } catch (e) {
        if (!cancelled) {
          setDupSeed(null);
          setDupErr(
            e instanceof Error ? e.message : "複製元の読み込みに失敗しました"
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [duplicateFrom, getToken, user]);

  async function save(values: DailyReportFormValues) {
    setBusy(true);
    try {
      const res = await authenticatedFetch(getToken, "/api/daily-reports", {
        method: "POST",
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
          currentProjectLines: values.currentProjectLines,
          tomorrowLines: values.tomorrowLines,
          summary: values.summary,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const reportId = data.item.id as string;
      setCreatedReportId(reportId);
      setSuccessMessage("提出完了　お疲れさまでした");
    } finally {
      setBusy(false);
    }
  }

  const visibleUserOptions = useMemo(
    () => filterVisibleUsers(userOptions, visibilityMode, pinnedVisibleUserIds),
    [userOptions, visibilityMode, pinnedVisibleUserIds]
  );

  if (!user)
    return <p className="text-sm text-zinc-500">読み込み中…</p>;

  const isDuplicate = Boolean(duplicateFrom);
  const dupLoading = isDuplicate && !dupSeed && !dupErr;

  return (
    <div className="space-y-8 pb-10">
      {successMessage ? (
        <SubmitSuccessOverlay message={successMessage} />
      ) : null}
      <header className="flex gap-3">
        <ReportDocumentIcon
          className="mt-1 h-8 w-8 shrink-0 text-sky-600"
          aria-hidden
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {isDuplicate ? "業務報告書の作成（複製）" : "業務報告書の作成"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {isDuplicate
              ? "元の内容が入力済みです。必要に応じて編集し「保存する」で新しい項目として保存されます。"
              : "SharePoint の「業務報告書」リストに保存されます。入力後は「保存する」を押してください。"}
          </p>
        </div>
      </header>
      {dupErr ? (
        <p className="text-sm text-red-600" role="alert">
          {dupErr}
        </p>
      ) : null}
      {dupLoading ? (
        <p className="text-sm text-zinc-500">複製元を読み込み中…</p>
      ) : (
        <DailyReportForm
          key={duplicateFrom ? `duplicate-${duplicateFrom}` : "new"}
          initial={dupSeed ?? undefined}
          onSubmit={save}
          submitting={busy}
          userOptions={visibleUserOptions}
          authorDisplayName={user?.displayName ?? ""}
        />
      )}
    </div>
  );
}

export default function NewReportPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-zinc-500">読み込み中…</p>}
    >
      <NewReportPageContent />
    </Suspense>
  );
}
