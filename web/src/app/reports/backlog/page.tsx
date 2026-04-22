"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import { useSessionStore } from "@/store/sessionStore";
import { useHandheldLines } from "@/hooks/useHandheldLines";
import { defaultHandheldLine } from "@/lib/storage/handheldProjects";
import { ReportsSubNav } from "@/components/reports/ReportsSubNav";
import {
  FieldLabel,
  FormShell,
  PrimaryButton,
  fieldInputClass,
} from "@/components/ui/FormPrimitives";
import { ReportDocumentIcon } from "@/components/ui/DocumentTypeIcons";

export default function HandheldBacklogPage() {
  const authed = useIsAuthenticated();
  const user = useSessionStore((s) => s.user);
  const router = useRouter();
  const {
    lines,
    setLines,
    persist,
    remote,
    loading,
    loadError,
    saveError,
    clearSaveError,
  } = useHandheldLines(user?.id);
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => {
    if (!authed) router.replace("/login");
  }, [authed, router]);

  function addRow() {
    setLines((prev) => [...prev, defaultHandheldLine()]);
  }

  function removeRow(i: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
  }

  function updateRow(
    i: number,
    key: "projectNumber" | "projectName",
    v: string
  ) {
    setLines((prev) =>
      prev.map((row, j) => (j === i ? { ...row, [key]: v } : row))
    );
  }

  if (!user)
    return <p className="text-sm text-zinc-500">読み込み中…</p>;

  return (
    <div className="space-y-4 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <ReportsSubNav />
          <div className="flex gap-3">
            <ReportDocumentIcon
              className="mt-1 h-8 w-8 shrink-0 text-sky-600"
              aria-hidden
            />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                手持ち案件
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                ここで登録した案件は、業務報告書の「本日の業務内容」「明日の作業予定」入力時にドロップダウンから呼び出せます。
                {remote
                  ? " SharePoint に保存しているため、別端末からも同じ内容が使えます。"
                  : " 現在はこのブラウザにのみ保存されています。別端末でも使うには env.example の「手持ち案件リスト」を設定してください。"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <PrimaryButton
            type="button"
            disabled={loading}
            onClick={() => {
              clearSaveError();
              void (async () => {
                try {
                  await persist();
                  setSavedNote(true);
                  window.setTimeout(() => setSavedNote(false), 2500);
                } catch {
                  /* saveError に表示 */
                }
              })();
            }}
          >
            {loading ? "読み込み中…" : "保存する"}
          </PrimaryButton>
          {saveError ? (
            <span className="max-w-xs text-right text-xs text-red-600">
              {saveError}
            </span>
          ) : null}
          {savedNote && !saveError ? (
            <span className="text-xs text-emerald-700">保存しました</span>
          ) : null}
        </div>
      </header>

      {loadError ? (
        <p className="text-sm text-amber-800" role="alert">
          サーバーからの読み込みに失敗したため、この端末に保存された内容を表示しています。
          {loadError}
        </p>
      ) : null}

      <FormShell className="space-y-3">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => addRow()}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            ＋ 行を追加
          </button>
        </div>
        <div className="space-y-2">
          {lines.map((row, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-200 bg-slate-50/80 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600">
                  行 {i + 1}
                </span>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => removeRow(i)}
                  >
                    削除
                  </button>
                ) : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-[6.5rem_1fr]">
                <div className="min-w-0">
                  <FieldLabel className="whitespace-nowrap">番号</FieldLabel>
                  <input
                    maxLength={8}
                    className={`${fieldInputClass} px-2 text-center text-sm`}
                    value={row.projectNumber}
                    onChange={(e) => updateRow(i, "projectNumber", e.target.value)}
                  />
                </div>
                <div className="min-w-0 sm:col-span-1">
                  <FieldLabel>案件名</FieldLabel>
                  <input
                    type="text"
                    className={fieldInputClass}
                    value={row.projectName}
                    onChange={(e) => updateRow(i, "projectName", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </FormShell>
    </div>
  );
}
