"use client";

import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useReactToPrint } from "react-to-print";
import type { WorkInstruction, WorkStyle } from "@/types/models";
import { workStyleLabel } from "@/lib/instruction/workStyleLabel";
import { formatSlashDateTime } from "@/lib/time/formatJa";
import { safePdfFilenamePart } from "@/lib/pdf/safePdfFilename";
import { WorkInstructionPrintDocument } from "./WorkInstructionPrintDocument";
import { useUnsavedChangesStore } from "@/store/unsavedChangesStore";
import {
  FieldError,
  FieldLabel,
  FormActions,
  FormSection,
  FormShell,
  PrimaryButton,
  SecondaryButton,
  fieldInputClass,
  fieldSelectClass,
  fieldTextareaClass,
} from "@/components/ui/FormPrimitives";

const projSchema = z.object({
  projectNumber: z.string(),
  projectName: z.string().min(1, "名称を入力してください"),
  taskDetail: z.string(),
});

const schema = z.object({
  targetUserId: z.string().min(1, "対象者を選択してください"),
  targetDate: z.string(),
  workStyle: z.enum(["office", "remote", "direct"]),
  projects: z.array(projSchema).min(1, "業務内容を1件以上入力してください"),
  note: z.string(),
});

export type WorkInstructionFormValues = z.infer<typeof schema>;

type UserOption = {
  id: string;
  displayName: string;
  email: string;
};

export function WorkInstructionForm({
  initial,
  users,
  onSubmit,
  submitting,
  lockTargetUserSelect,
  readOnly,
  instructorDisplayName = "",
  submitLabel = "保存する",
  formActionsExtra,
}: {
  initial?: Partial<WorkInstruction> | null;
  users: UserOption[];
  onSubmit: (values: WorkInstructionFormValues) => Promise<void>;
  submitting?: boolean;
  /** 対象者のユーザーを変更できないようにする（対象者本人が編集するときなど） */
  lockTargetUserSelect?: boolean;
  /** 閲覧専用（全フィールド無効・更新不可） */
  readOnly?: boolean;
  /** PDF・印刷用（指示者の表示名） */
  instructorDisplayName?: string;
  submitLabel?: string;
  formActionsExtra?: ReactNode;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const defaults = useMemo(
    () => ({
      targetUserId: initial?.targetUserId ?? "",
      targetDate: initial?.targetDate ?? "",
      workStyle: (initial?.workStyle ?? "office") as WorkStyle,
      projects:
        initial?.projects?.length && initial.projects.length > 0
          ? initial.projects.map((p) => ({
              projectNumber: p.projectNumber ?? "",
              projectName: p.projectName,
              taskDetail: p.taskDetail,
            }))
          : [{ projectNumber: "", projectName: "", taskDetail: "" }],
      note: initial?.note ?? "",
    }),
    [initial]
  );

  const form = useForm<WorkInstructionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const setDirty = useUnsavedChangesStore((s) => s.setDirty);
  useEffect(() => {
    const dirty =
      Boolean(form.formState.isDirty) && !Boolean(submitting) && !Boolean(readOnly);
    setDirty(dirty);
  }, [form.formState.isDirty, setDirty, submitting, readOnly]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!form.formState.isDirty || readOnly) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [form.formState.isDirty, readOnly]);

  useEffect(() => {
    form.reset(defaults);
  }, [defaults, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "projects",
  });

  const targetUserIdWatch = useWatch({
    control: form.control,
    name: "targetUserId",
  });
  const noteWatch = useWatch({ control: form.control, name: "note" });
  const assigneeDisplayName = useMemo(() => {
    const id = targetUserIdWatch ?? "";
    if (!id) return "";
    return (
      users.find((u) => u.id === id)?.displayName ||
      users.find((u) => u.id === id)?.email ||
      ""
    );
  }, [targetUserIdWatch, users]);

  const printTitle = useMemo(() => {
    const ymd = String(form.getValues("targetDate") || "").slice(0, 10).trim();
    const ymdCompact = ymd ? ymd.replaceAll("-", "") : "draft";
    const assignee = safePdfFilenamePart(assigneeDisplayName || "被支持者");
    return `業務指示書_${assignee}_${ymdCompact}`;
  }, [assigneeDisplayName, form]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: printTitle,
    pageStyle:
      "@page { size: A4; margin: 14mm; } @media print { body { -webkit-print-color-adjust: exact; } }",
  });

  const snapshot: WorkInstruction = {
    id: initial?.id ?? "preview",
    adminId: initial?.adminId ?? "",
    targetUserId: form.watch("targetUserId"),
    linkedReportId: initial?.linkedReportId ?? "",
    targetDate: form.watch("targetDate"),
    workStyle: form.watch("workStyle"),
    projects: form.watch("projects"),
    note: form.watch("note"),
    createdAt: initial?.createdAt ?? "",
    submittedAt: initial?.submittedAt ?? "",
  };

  const errs = form.formState.errors;

  return (
    <FormShell>
      <form
        onSubmit={form.handleSubmit(async (v) => {
          await onSubmit(v);
          form.reset(v);
          useUnsavedChangesStore.getState().setDirty(false);
        })}
        className="relative"
        noValidate
      >
        <FormSection
          title="基本情報"
          description="指示者・対象者・対象日・勤務形態を指定します。"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel>指示者</FieldLabel>
              <p className="mt-1.5 text-sm text-slate-800">
                {instructorDisplayName.trim() || "—"}
              </p>
            </div>
            <div>
              <FieldLabel required>対象者</FieldLabel>
              <select
                className={fieldSelectClass}
                {...form.register("targetUserId")}
                disabled={Boolean(readOnly) || lockTargetUserSelect}
              >
                <option value="">選択してください</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName || u.email}
                  </option>
                ))}
              </select>
              <FieldError message={errs.targetUserId?.message} />
            </div>
            <div>
              <FieldLabel>対象日</FieldLabel>
              <input
                type="date"
                className={fieldInputClass}
                {...form.register("targetDate")}
                disabled={Boolean(readOnly)}
              />
            </div>
            {initial?.id && initial.id !== "preview" ? (
              <>
                <div>
                  <FieldLabel>指示日</FieldLabel>
                  <p className="mt-1.5 text-sm text-slate-800">
                    {initial.createdAt
                      ? formatSlashDateTime(initial.createdAt)
                      : "—"}
                  </p>
                </div>
                <div>
                  <FieldLabel>更新日</FieldLabel>
                  <p className="mt-1.5 text-sm text-slate-800">
                    {shouldShowUpdatedAt(initial.createdAt, initial.submittedAt)
                      ? formatSlashDateTime(initial.submittedAt ?? "")
                      : ""}
                  </p>
                </div>
              </>
            ) : null}
            <div className="sm:col-span-2">
              <FieldLabel>勤務形態（出社 / テレワーク / 直行）</FieldLabel>
              <select
                className={fieldSelectClass}
                {...form.register("workStyle")}
                disabled={Boolean(readOnly)}
              >
                <option value="office">{workStyleLabel("office")}</option>
                <option value="remote">{workStyleLabel("remote")}</option>
                <option value="direct">{workStyleLabel("direct")}</option>
              </select>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="業務内容"
          description="指示するプロジェクト・タスクを行で追加できます。"
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                append({ projectNumber: "", projectName: "", taskDetail: "" })
              }
              disabled={Boolean(readOnly)}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              ＋ 行を追加
            </button>
          </div>
          <FieldError message={errs.projects?.message} />
          <div className="space-y-4">
            {fields.map((f, i) => (
              <div
                key={f.id}
                className="rounded-lg border border-slate-200 bg-slate-50/80 p-4"
              >
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  行 {i + 1}
                </p>
                <div className="grid gap-4 sm:grid-cols-12">
                  <div className="sm:col-span-2">
                    <FieldLabel className="whitespace-nowrap">
                      番号
                    </FieldLabel>
                    <input
                      className={fieldInputClass}
                      {...form.register(`projects.${i}.projectNumber`)}
                      disabled={Boolean(readOnly)}
                    />
                  </div>
                  <div className="sm:col-span-10">
                    <FieldLabel required>名称</FieldLabel>
                    <input
                      className={fieldInputClass}
                      {...form.register(`projects.${i}.projectName`)}
                      disabled={Boolean(readOnly)}
                    />
                    <FieldError
                      message={
                        errs.projects?.[i]?.projectName?.message as
                          | string
                          | undefined
                      }
                    />
                  </div>
                  <div className="sm:col-span-12">
                    <FieldLabel>詳細</FieldLabel>
                    <textarea
                      rows={3}
                      className={fieldTextareaClass}
                      {...form.register(`projects.${i}.taskDetail`)}
                      disabled={Boolean(readOnly)}
                    />
                  </div>
                  {fields.length > 1 && (
                    <div className="sm:col-span-12">
                      <button
                        type="button"
                        className="text-sm text-red-600 hover:underline"
                        onClick={() => remove(i)}
                        disabled={Boolean(readOnly)}
                      >
                        この行を削除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </FormSection>

        <FormSection title="備考">
          <div>
            <FieldLabel>内容</FieldLabel>
            <textarea
              rows={8}
              className={`${fieldTextareaClass} min-h-[12rem]`}
              placeholder="連絡事項や注意点（長文可）"
              {...form.register("note")}
              disabled={Boolean(readOnly)}
            />
          </div>
        </FormSection>

        <FormActions>
          {readOnly ? null : (
            <>
              <PrimaryButton type="submit" disabled={submitting}>
                {submitting ? "保存中…" : submitLabel}
              </PrimaryButton>
              {formActionsExtra}
            </>
          )}
          <SecondaryButton onClick={() => handlePrint()}>印刷</SecondaryButton>
        </FormActions>
      </form>

      <div
        className="pointer-events-none absolute -left-[9999px] top-0 w-[210mm] bg-white p-4 text-black"
        aria-hidden
      >
        <WorkInstructionPrintDocument
          instruction={snapshot}
          notePlain={noteWatch}
          contentRef={printRef}
          instructorName={instructorDisplayName}
          assigneeName={assigneeDisplayName}
        />
      </div>
    </FormShell>
  );
}

function shouldShowUpdatedAt(
  createdAt: string | undefined,
  submittedAt: string | undefined
): boolean {
  const s = (submittedAt ?? "").trim();
  if (!s) return false;
  const c = (createdAt ?? "").trim();
  if (!c) return true;
  const pc = Date.parse(c);
  const ps = Date.parse(s);
  if (!Number.isFinite(pc) || !Number.isFinite(ps)) return s !== c;
  // 作成直後は createdAt と lastModified(submittedAt) が同値になりがちなので、その場合は「未更新」とみなす
  return Math.abs(ps - pc) > 1000;
}
