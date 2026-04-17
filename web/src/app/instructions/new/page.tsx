"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { WorkInstructionForm } from "@/components/instructions/WorkInstructionForm";
import type { WorkInstructionFormValues } from "@/components/instructions/WorkInstructionForm";
import { useAccessToken } from "@/hooks/useAccessToken";
import { authenticatedFetch } from "@/lib/api/authenticatedFetch";
import {
  seedWorkInstructionFromReportTomorrow,
} from "@/lib/form/duplicateSeed";
import { useRouter, useSearchParams } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import { useSessionStore } from "@/store/sessionStore";
import {
  fallbackUserOption,
  filterVisibleUsers,
  mergeUserIfMissing,
} from "@/lib/directory/filterVisibleUsers";
import { useDirectoryVisibilityStore } from "@/store/directoryVisibilityStore";
import type { DailyReport, DirectoryUser, WorkInstruction } from "@/types/models";
import { InstructionDocumentIcon } from "@/components/ui/DocumentTypeIcons";
import { SubmitSuccessOverlay } from "@/components/ui/SubmitSuccessOverlay";

function NewInstructionPageContent() {
  const searchParams = useSearchParams();
  const fromReportId = searchParams.get("fromReport");

  const visibilityMode = useDirectoryVisibilityStore((s) => s.mode);
  const pinnedVisibleUserIds = useDirectoryVisibilityStore(
    (s) => s.pinnedVisibleUserIds
  );
  const authed = useIsAuthenticated();
  const { getToken } = useAccessToken();
  const user = useSessionStore((s) => s.user);
  const router = useRouter();
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [dupSeed, setDupSeed] = useState<Partial<WorkInstruction> | null>(
    null
  );
  const [dupErr, setDupErr] = useState<string | null>(null);
  const [postLinkedReportId, setPostLinkedReportId] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authed) router.replace("/login");
  }, [authed, router]);

  useEffect(() => {
    if (!successMessage) return;
    const t = window.setTimeout(() => {
      router.push("/instructions");
    }, 2600);
    return () => window.clearTimeout(t);
  }, [successMessage, router]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const uRes = await authenticatedFetch(getToken, "/api/users");
      const uJson = await uRes.json();
      if (uRes.ok) {
        setUsers((uJson.items ?? []) as DirectoryUser[]);
      }
    })();
  }, [getToken, user]);

  useEffect(() => {
    if (!user) return;
    if (!fromReportId) {
      setDupSeed(null);
      setDupErr(null);
      setPostLinkedReportId("");
    }
  }, [fromReportId, user]);

  useEffect(() => {
    if (!fromReportId || !user) return;
    let cancelled = false;
    setDupErr(null);
    void (async () => {
      try {
        const res = await authenticatedFetch(
          getToken,
          `/api/daily-reports/${fromReportId}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const item = data.item as DailyReport;
        if (!cancelled) {
          setDupSeed(seedWorkInstructionFromReportTomorrow(item));
          setPostLinkedReportId(item.id);
        }
      } catch (e) {
        if (!cancelled) {
          setDupSeed(null);
          setPostLinkedReportId("");
          setDupErr(
            e instanceof Error
              ? e.message
              : "報告書の読み込みに失敗しました（権限または ID を確認してください）"
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromReportId, getToken, user]);

  async function save(values: WorkInstructionFormValues) {
    setBusy(true);
    try {
      const res = await authenticatedFetch(getToken, "/api/work-instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: values.targetUserId,
          linkedReportId: postLinkedReportId || "",
          targetDate: values.targetDate || undefined,
          workStyle: values.workStyle,
          projects: values.projects,
          note: values.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccessMessage("業務指示書が発行されました");
    } finally {
      setBusy(false);
    }
  }

  const userOptions = useMemo(() => {
    const vis = filterVisibleUsers(users, visibilityMode, pinnedVisibleUserIds);
    const withTarget = dupSeed?.targetUserId
      ? mergeUserIfMissing(
          vis,
          dupSeed.targetUserId,
          (id) => fallbackUserOption(id, `対象者 (${id.slice(0, 8)}…)`)
        )
      : vis;
    return withTarget.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      email: u.email,
    }));
  }, [users, visibilityMode, pinnedVisibleUserIds, dupSeed?.targetUserId]);

  if (!user) {
    return <p className="text-sm text-slate-500">読み込み中…</p>;
  }

  const isFromReport = Boolean(fromReportId);
  const dupLoading = isFromReport && !dupSeed && !dupErr;

  const formKey = fromReportId ? `from-report-${fromReportId}` : "new";

  return (
    <div className="relative space-y-8 pb-10">
      {successMessage ? (
        <SubmitSuccessOverlay message={successMessage} />
      ) : null}
      <header className="flex gap-3">
        <InstructionDocumentIcon
          className="mt-1 h-8 w-8 shrink-0 text-amber-600"
          aria-hidden
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {isFromReport ? "業務指示書の作成（報告書から）" : "業務指示書の作成"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {isFromReport
              ? "報告書の「明日の作業予定」を業務内容に取り込んでいます。必要に応じて編集して保存してください。"
              : "対象者と内容を入力して保存します。"}
          </p>
        </div>
      </header>
      {dupErr ? (
        <p className="text-sm text-red-600" role="alert">
          {dupErr}
        </p>
      ) : null}
      {dupLoading ? (
        <p className="text-sm text-zinc-500">読み込み中…</p>
      ) : (
        <WorkInstructionForm
          key={formKey}
          initial={dupSeed ?? undefined}
          users={userOptions}
          onSubmit={save}
          submitting={busy}
          instructorDisplayName={user?.displayName ?? ""}
        />
      )}
    </div>
  );
}

export default function NewInstructionPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-zinc-500">読み込み中…</p>}
    >
      <NewInstructionPageContent />
    </Suspense>
  );
}
