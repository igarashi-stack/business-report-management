"use client";

import { WorkInstructionForm } from "@/components/instructions/WorkInstructionForm";
import type { WorkInstructionFormValues } from "@/components/instructions/WorkInstructionForm";
import { useAccessToken } from "@/hooks/useAccessToken";
import { authenticatedFetch } from "@/lib/api/authenticatedFetch";
import { useRouter, useParams } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import { useSessionStore } from "@/store/sessionStore";
import { useEffect, useState, useMemo } from "react";
import {
  fallbackUserOption,
  filterVisibleUsers,
  mergeUserIfMissing,
} from "@/lib/directory/filterVisibleUsers";
import { useDirectoryVisibilityStore } from "@/store/directoryVisibilityStore";
import type { WorkInstruction } from "@/types/models";
import { InstructionDocumentIcon } from "@/components/ui/DocumentTypeIcons";
import { useSeenStore } from "@/store/seenStore";

type UserOption = { id: string; displayName: string; email: string };

export default function EditInstructionPage() {
  const visibilityMode = useDirectoryVisibilityStore((s) => s.mode);
  const pinnedVisibleUserIds = useDirectoryVisibilityStore(
    (s) => s.pinnedVisibleUserIds
  );
  const params = useParams();
  const id = params.id as string;
  const authed = useIsAuthenticated();
  const { getToken } = useAccessToken();
  const user = useSessionStore((s) => s.user);
  const markInstructionSeen = useSeenStore((s) => s.markInstructionSeen);
  const router = useRouter();
  const [row, setRow] = useState<WorkInstruction | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lockTargetUser, setLockTargetUser] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    if (!authed) router.replace("/login");
  }, [authed, router]);

  useEffect(() => {
    if (!user || !id) return;
    void (async () => {
      try {
        const [wRes, uRes] = await Promise.all([
          authenticatedFetch(getToken, `/api/work-instructions/${id}`),
          authenticatedFetch(getToken, "/api/users"),
        ]);
        const wJson = await wRes.json();
        const uJson = await uRes.json();
        if (!wRes.ok) throw new Error(wJson.error);
        const item = wJson.item as WorkInstruction;
        const isAdmin = item.adminId === user.id;
        const isRecipient = item.targetUserId === user.id;
        setReadOnly(!isAdmin && !isRecipient);
        setLockTargetUser(!isAdmin && isRecipient);
        setRow(item);
        if (uRes.ok) {
          setUsers(
            (uJson.items ?? []).map(
              (x: { id: string; displayName: string; email: string }) => ({
                id: x.id,
                displayName: x.displayName,
                email: x.email,
              })
            )
          );
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "読み込み失敗");
      }
    })();
  }, [getToken, id, user]);

  // 閲覧（編集画面を開いた）= 既読扱い
  useEffect(() => {
    if (!user?.id || !id) return;
    markInstructionSeen(user.id, id);
    void (async () => {
      try {
        await authenticatedFetch(getToken, "/api/seen/mark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "instruction", id }),
        });
      } catch {
        // 既読同期の失敗は致命的ではないため握りつぶす
      }
    })();
  }, [getToken, id, markInstructionSeen, user?.id]);

  const userOptionsForForm = useMemo(
    () =>
      mergeUserIfMissing(
        filterVisibleUsers(users, visibilityMode, pinnedVisibleUserIds),
        row?.targetUserId,
        (id) => fallbackUserOption(id, `対象者 (${id.slice(0, 8)}…)`)
      ),
    [users, visibilityMode, pinnedVisibleUserIds, row?.targetUserId]
  );

  const instructorOptionsForForm = useMemo(
    () =>
      mergeUserIfMissing(
        userOptionsForForm,
        row?.adminId,
        (id) => fallbackUserOption(id, `指示者 (${id.slice(0, 8)}…)`)
      ),
    [userOptionsForForm, row?.adminId]
  );

  const instructorDisplayName = useMemo(() => {
    if (!row || !user) return "";
    if (row.adminId === user.id) return user.displayName ?? "";
    return (
      instructorOptionsForForm.find((u) => u.id === row.adminId)?.displayName ??
      ""
    );
  }, [row, user, instructorOptionsForForm]);

  async function save(values: WorkInstructionFormValues) {
    const current = row;
    if (!current) return;
    setBusy(true);
    try {
      const res = await authenticatedFetch(getToken, `/api/work-instructions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: values.targetUserId,
          linkedReportId: current.linkedReportId ?? "",
          targetDate: values.targetDate || "",
          workStyle: values.workStyle,
          projects: values.projects,
          note: values.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRow((data.item ?? current) as WorkInstruction);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteInstruction() {
    if (!row) return;
    if (
      !confirm(
        "この業務指示書を削除しますか？SharePoint のリストからも削除され、元に戻せません。"
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await authenticatedFetch(
        getToken,
        `/api/work-instructions/${id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "削除に失敗しました");
      router.push("/instructions");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return <p className="text-sm text-zinc-500">読み込み中…</p>;
  }
  if (err && !row) {
    return <p className="text-sm text-red-600">{err}</p>;
  }
  if (!row) {
    return <p className="text-sm text-zinc-500">読み込み中…</p>;
  }

  return (
    <div className="relative space-y-8 pb-10">
      <header className="flex gap-3">
        <InstructionDocumentIcon
          className="mt-1 h-8 w-8 shrink-0 text-amber-600"
          aria-hidden
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            業務指示書の編集
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {lockTargetUser
              ? "対象者として業務内容・備考などを更新できます。変更後は「更新」を押してください。"
              : "変更後は「更新」を押してください。"}
          </p>
        </div>
      </header>
      {err && row ? (
        <p className="text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}
      <WorkInstructionForm
        initial={row}
        users={userOptionsForForm}
        onSubmit={save}
        submitting={busy}
        lockTargetUserSelect={lockTargetUser}
        readOnly={readOnly}
        instructorDisplayName={instructorDisplayName}
        submitLabel="更新"
        formActionsExtra={
          readOnly ? null : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDeleteInstruction()}
                className="inline-flex min-h-[42px] items-center justify-center rounded-lg border border-red-200 bg-white px-5 text-sm font-medium text-red-800 shadow-sm transition hover:bg-red-50 disabled:opacity-50"
              >
                削除
              </button>
            </>
          )
        }
      />
    </div>
  );
}
