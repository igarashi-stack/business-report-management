"use client";

import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReactToPrint } from "react-to-print";
import type { DailyReport, ReportProjectLine, WorkStyle } from "@/types/models";
import { workStyleLabel } from "@/lib/instruction/workStyleLabel";
import { safePdfFilenamePart } from "@/lib/pdf/safePdfFilename";
import {
  isValidShiftClockHm,
  minutesBetween,
  minutesToHoursDecimal,
} from "@/lib/time/duration";
import { formatSlashDateTime } from "@/lib/time/formatJa";
import { handheldSnapshotForReport } from "@/lib/storage/handheldProjects";
import { DailyReportPrintDocument } from "./DailyReportPrintDocument";
import { TimeHmSelects } from "./TimeHmSelects";
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

const taskSchema = z.object({
  projectNumber: z.string(),
  projectName: z.string().min(1, "案件名を入力してください"),
  taskDetail: z.string(),
  // 仕様: 必須入力は「提出先・報告日・案件名」のみ。時刻は未入力でも保存できるようにする。
  startTime: z
    .string()
    .refine(
      (s) => !s.trim() || /^\d{2}:\d{2}$/.test(s),
      "HH:mm 形式（例 09:00）"
    ),
  endTime: z
    .string()
    .refine((s) => !s.trim() || /^\d{2}:\d{2}$/.test(s), "HH:mm 形式"),
  duration: z.number().min(0),
});

const projectLineSchema = z.object({
  projectNumber: z.string(),
  projectName: z.string(),
  content: z.string(),
});

const optionalClockIn = z
  .string()
  .refine((s) => isValidShiftClockHm(s), "時刻を選んでください");

const optionalClockOut = z
  .string()
  .refine((s) => isValidShiftClockHm(s), "時刻を選んでください");

const schema = z.object({
  date: z.string().min(1, "日付を選んでください"),
  weekday: z.string(),
  workStyle: z.enum(["office", "remote", "direct"]),
  clockInTime: optionalClockIn,
  clockOutTime: optionalClockOut,
  breakDurationHours: z
    .number({ error: "休憩時間は数値で入力してください" })
    .min(0, "0以上")
    .max(24),
  submissionTargetId: z.string().min(1, "提出先を選んでください"),
  tasks: z.array(taskSchema).min(1, "タスクを1件以上入力してください"),
  tomorrowLines: z.array(projectLineSchema).min(1),
  summary: z.string(),
  totalWorkTime: z.number(),
});

export type DailyReportFormValues = z.infer<typeof schema>;

function defaultTask() {
  return {
    projectNumber: "",
    projectName: "",
    taskDetail: "",
    startTime: "09:30",
    endTime: "",
    duration: 0,
  };
}

function defaultProjectLine() {
  return { projectNumber: "", projectName: "", content: "" };
}

function lineHasPickableContent(l: ReportProjectLine): boolean {
  return Boolean(
    l.projectNumber?.trim() ||
      l.projectName?.trim() ||
      l.content?.trim()
  );
}

function HandheldLinePicker({
  lines,
  onPick,
}: {
  lines: ReportProjectLine[];
  onPick: (line: ReportProjectLine) => void;
}) {
  const pickableLines = useMemo(
    () => lines.filter(lineHasPickableContent),
    [lines]
  );
  const pickable = pickableLines.length > 0;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const listId = useMemo(
    () => `handheld-picker-${Math.random().toString(36).slice(2)}`,
    []
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return pickableLines;
    return pickableLines.filter((l) => {
      const s = `${l.projectNumber} ${l.projectName}`.toLowerCase();
      return s.includes(query);
    });
  }, [pickableLines, q]);

  return (
    <div className="min-w-0">
      <button
        type="button"
        disabled={!pickable}
        onClick={() => {
          setQ("");
          setOpen(true);
        }}
        className="mt-1 inline-flex min-h-[38px] items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{pickable ? "手持ちから入力" : "手持ち案件が未登録です"}</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="手持ち案件から選択"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  手持ち案件から選択
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  選ぶと、番号・案件名を入力欄に反映します。
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-slate-600 hover:text-slate-900"
                onClick={() => setOpen(false)}
              >
                閉じる
              </button>
            </div>

            <div className="p-4">
              <input
                autoFocus
                className={fieldInputClass}
                placeholder="検索（番号 / 案件名）"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-controls={listId}
              />

              <div
                id={listId}
                className="mt-3 max-h-[50vh] overflow-auto rounded-md border border-slate-200"
              >
                {filtered.length === 0 ? (
                  <p className="p-3 text-sm text-slate-600">
                    該当する手持ち案件がありません。
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {filtered.map((l, idx) => {
                      const title =
                        [l.projectNumber, l.projectName]
                          .filter((x) => x?.trim())
                          .join(" ") || `行 ${idx + 1}`;
                      return (
                        <li key={`${l.projectNumber}-${l.projectName}-${idx}`}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left hover:bg-slate-50"
                            onClick={() => {
                              onPick({ ...l });
                              setOpen(false);
                            }}
                          >
                            <p className="text-sm font-medium text-slate-900">
                              {title}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type UserOption = { id: string; displayName: string; email: string };

export function DailyReportForm({
  initial,
  onSubmit,
  submitting,
  userOptions,
  authorDisplayName = "",
  submitLabel = "保存する",
  formActionsExtra,
  handheldLines,
}: {
  initial?: Partial<DailyReport> | null;
  onSubmit: (values: DailyReportFormValues) => Promise<void>;
  submitting?: boolean;
  /** 提出先（Entra ユーザー一覧） */
  userOptions: UserOption[];
  /** PDF・印刷用の記入者表示名 */
  authorDisplayName?: string;
  /** 送信ボタン文言（編集画面では「更新」など） */
  submitLabel?: string;
  /** 送信の左隣に並べるボタンなど（例: 複製） */
  formActionsExtra?: ReactNode;
  /** 手持ち案件タブで管理している一覧（ドロップダウン・印刷プレビュー用） */
  handheldLines: ReportProjectLine[];
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [printTitle, setPrintTitle] = useState("");

  const defaults = useMemo(
    () => ({
      date: initial?.date ?? format(new Date(), "yyyy-MM-dd"),
      weekday: initial?.weekday ?? "",
      workStyle: (initial?.workStyle ?? "office") as WorkStyle,
      clockInTime: initial?.clockInTime ?? "09:30",
      clockOutTime: initial?.clockOutTime ?? "18:30",
      breakDurationHours:
        typeof initial?.breakDurationHours === "number" &&
        initial.breakDurationHours >= 0
          ? initial.breakDurationHours
          : 1,
      submissionTargetId: initial?.submissionTargetId ?? "",
      tasks: initial?.tasks?.length ? initial.tasks : [defaultTask()],
      tomorrowLines:
        initial?.tomorrowLines && initial.tomorrowLines.length > 0
          ? initial.tomorrowLines
          : [defaultProjectLine()],
      summary: initial?.summary ?? "",
      totalWorkTime: initial?.totalWorkTime ?? 0,
    }),
    [initial]
  );

  const form = useForm<DailyReportFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    const ymd = String(form.getValues("date") || "").slice(0, 10).trim();
    const ymdCompact = ymd ? ymd.replaceAll("-", "") : "draft";
    const author = safePdfFilenamePart(authorDisplayName || "報告者");
    setPrintTitle(`業務報告書_${author}_${ymdCompact}`);
  }, [authorDisplayName, form]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: printTitle,
    pageStyle:
      "@page { size: A4; margin: 14mm; } @media print { body { -webkit-print-color-adjust: exact; } }",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "tasks",
  });

  const {
    fields: tomorrowFields,
    append: appendTomorrow,
    remove: removeTomorrow,
  } = useFieldArray({ control: form.control, name: "tomorrowLines" });

  const dateVal = form.watch("date");
  const watchedTasks = useWatch({ control: form.control, name: "tasks" }) ?? [];
  const watchedBreak = useWatch({
    control: form.control,
    name: "breakDurationHours",
  });
  const watchedClockIn = useWatch({
    control: form.control,
    name: "clockInTime",
  });
  const watchedClockOut = useWatch({
    control: form.control,
    name: "clockOutTime",
  });
  const submissionTargetIdWatch = useWatch({
    control: form.control,
    name: "submissionTargetId",
  });

  const submissionTargetDisplayName = useMemo(() => {
    const id = submissionTargetIdWatch ?? "";
    if (!id) return "";
    return (
      userOptions.find((u) => u.id === id)?.displayName ||
      userOptions.find((u) => u.id === id)?.email ||
      ""
    );
  }, [submissionTargetIdWatch, userOptions]);

  useEffect(() => {
    if (!dateVal) return;
    try {
      const d = new Date(dateVal + "T12:00:00");
      const wk = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()] ?? "";
      form.setValue("weekday", wk, {
        shouldValidate: false,
      });
    } catch {
      /* ignore */
    }
  }, [dateVal, form]);

  useEffect(() => {
    if (!watchedTasks.length) return;
    watchedTasks.forEach((t, i) => {
      const start = (t?.startTime ?? "").trim();
      const end = (t?.endTime ?? "").trim();
      if (!start || !end) return;
      if (!isValidShiftClockHm(start) || !isValidShiftClockHm(end)) return;
      const mins = minutesBetween(start, end);
      const cur = form.getValues(`tasks.${i}.duration`);
      if (cur !== mins) {
        form.setValue(`tasks.${i}.duration`, mins, {
          shouldValidate: false,
          shouldDirty: false,
          shouldTouch: false,
        });
      }
    });
  }, [watchedTasks, form]);

  /** 勤務時間（実働）＝退勤−出社（区間）−休憩（時間） */
  useEffect(() => {
    const cin = (watchedClockIn ?? "").trim();
    const cout = (watchedClockOut ?? "").trim();
    const br =
      typeof watchedBreak === "number" && watchedBreak >= 0 ? watchedBreak : 1;
    let net = 0;
    if (
      cin &&
      cout &&
      isValidShiftClockHm(cin) &&
      isValidShiftClockHm(cout)
    ) {
      const grossMin = minutesBetween(cin, cout);
      const grossHours = minutesToHoursDecimal(grossMin);
      net = Math.max(0, Math.round((grossHours - br) * 1000) / 1000);
    }
    if (form.getValues("totalWorkTime") !== net) {
      form.setValue("totalWorkTime", net, {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }, [watchedClockIn, watchedClockOut, watchedBreak, form]);

  const snapshot: DailyReport = {
    id: initial?.id ?? "preview",
    userId: initial?.userId ?? "",
    submissionTargetId: form.watch("submissionTargetId"),
    date: form.watch("date"),
    weekday: form.watch("weekday"),
    workStyle: form.watch("workStyle"),
    clockInTime: form.watch("clockInTime")?.trim() ?? "",
    clockOutTime: form.watch("clockOutTime")?.trim() ?? "",
    breakDurationHours:
      typeof watchedBreak === "number" && watchedBreak >= 0 ? watchedBreak : 1,
    totalWorkTime: form.watch("totalWorkTime"),
    tasks: form.watch("tasks"),
    currentProjectLines: handheldSnapshotForReport(handheldLines),
    tomorrowLines: form.watch("tomorrowLines"),
    summary: form.watch("summary"),
    createdAt: initial?.createdAt ?? "",
    submittedAt: initial?.submittedAt ?? "",
  };

  const errs = form.formState.errors;
  const taskGrossHours = useMemo(() => {
    let sumMin = 0;
    for (const t of watchedTasks) {
      sumMin += minutesBetween(
        t?.startTime ?? "00:00",
        t?.endTime ?? "00:00"
      );
    }
    return minutesToHoursDecimal(sumMin);
  }, [watchedTasks]);

  return (
    <FormShell className="space-y-4">
      <form
        onSubmit={form.handleSubmit((v) => void onSubmit(v))}
        className="print:hidden"
        noValidate
      >
        <FormSection
          title="基本情報"
          description="記入者・提出先・報告日を入力します。提出先を選ぶと、その方のダッシュボードに業務報告書提出の通知が表示されます。"
          dense
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel>記入者</FieldLabel>
              <p className="mt-1 text-sm text-slate-800">
                {authorDisplayName.trim() || "—"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="submission-target" required>
                提出先
              </FieldLabel>
              <select
                id="submission-target"
                className={fieldSelectClass}
                {...form.register("submissionTargetId")}
              >
                <option value="">選んでください</option>
                {userOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName || u.email || u.id}
                    {u.email ? `（${u.email}）` : ""}
                  </option>
                ))}
              </select>
              <FieldError message={errs.submissionTargetId?.message} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <FieldLabel htmlFor="report-date" required>
                報告日
              </FieldLabel>
              <input
                id="report-date"
                type="date"
                className={fieldInputClass}
                {...form.register("date")}
              />
              <input type="hidden" {...form.register("weekday")} />
              <FieldError message={errs.date?.message} />
            </div>
            {initial?.id && initial.id !== "preview" ? (
              <div className="sm:col-span-2">
                <FieldLabel>更新日</FieldLabel>
                <p className="mt-1 text-sm text-slate-800">
                  {initial.submittedAt
                    ? formatSlashDateTime(initial.submittedAt)
                    : "—"}
                </p>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="report-work-style">勤務形態</FieldLabel>
              <select
                id="report-work-style"
                className={fieldSelectClass}
                {...form.register("workStyle")}
              >
                <option value="office">{workStyleLabel("office")}</option>
                <option value="remote">{workStyleLabel("remote")}</option>
                <option value="direct">{workStyleLabel("direct")}</option>
              </select>
              <FieldError message={errs.workStyle?.message} />
            </div>
            <div>
              <TimeHmSelects
                idPrefix="clock-in"
                label="出社時間"
                value={form.watch("clockInTime") ?? ""}
                onChange={(v) =>
                  form.setValue("clockInTime", v, { shouldValidate: true })
                }
                variant="shift"
              />
              <FieldError message={errs.clockInTime?.message as string} />
            </div>
            <div>
              <TimeHmSelects
                idPrefix="clock-out"
                label="退勤時間"
                value={form.watch("clockOutTime") ?? ""}
                onChange={(v) =>
                  form.setValue("clockOutTime", v, { shouldValidate: true })
                }
                variant="shift"
              />
              <FieldError message={errs.clockOutTime?.message as string} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="break-hours">休憩時間（時間）</FieldLabel>
              <input
                id="break-hours"
                type="number"
                min={0}
                max={24}
                step={0.25}
                className={fieldInputClass}
                {...form.register("breakDurationHours", {
                  valueAsNumber: true,
                })}
              />
              <FieldError message={errs.breakDurationHours?.message as string} />
            </div>
          </div>
        </FormSection>

        <FormSection
          title="本日の業務内容"
          description="案件ごとに作業時間を入力します。手持ち案件タブで登録した内容を、ドロップダウンから呼び出せます。"
          dense
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => append(defaultTask())}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              ＋ 行を追加
            </button>
          </div>
          <FieldError message={errs.tasks?.message} />
          <div className="space-y-2">
            {fields.map((f, i) => (
              <div
                key={f.id}
                className="rounded-lg border border-slate-200 bg-slate-50/80 p-3"
              >
                <p className="mb-2 text-xs font-semibold text-blue-600">
                  タスク {i + 1}
                </p>
                <div className="flex flex-col gap-2">
                  <HandheldLinePicker
                    lines={handheldLines}
                    onPick={(line) => {
                      form.setValue(`tasks.${i}.projectNumber`, line.projectNumber);
                      form.setValue(`tasks.${i}.projectName`, line.projectName);
                      // 手持ち案件リストから「内容」は廃止
                      form.setValue(`tasks.${i}.taskDetail`, "");
                    }}
                  />
                  <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(5rem,6.5rem)_1fr]">
                    <div className="min-w-0">
                      <FieldLabel className="whitespace-nowrap">
                        番号
                      </FieldLabel>
                      <input
                        maxLength={8}
                        className={`${fieldInputClass} w-full max-w-[6.5rem] px-2 text-center text-sm`}
                        {...form.register(`tasks.${i}.projectNumber`)}
                      />
                    </div>
                    <div className="min-w-0">
                      <FieldLabel required>案件名</FieldLabel>
                      <input
                        type="text"
                        className={fieldInputClass}
                        {...form.register(`tasks.${i}.projectName`)}
                      />
                      <FieldError
                        message={
                          errs.tasks?.[i]?.projectName?.message as
                            | string
                            | undefined
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <TimeHmSelects
                      idPrefix={`task-${i}-start`}
                      label="開始"
                      value={form.watch(`tasks.${i}.startTime`) ?? ""}
                      onChange={(v) =>
                        form.setValue(`tasks.${i}.startTime`, v, {
                          shouldValidate: true,
                        })
                      }
                      variant="task"
                    />
                    <TimeHmSelects
                      idPrefix={`task-${i}-end`}
                      label="終了"
                      value={form.watch(`tasks.${i}.endTime`) ?? ""}
                      onChange={(v) =>
                        form.setValue(`tasks.${i}.endTime`, v, {
                          shouldValidate: true,
                        })
                      }
                      variant="task"
                    />
                    <div className="flex flex-col sm:min-w-[5rem]">
                      <span className="text-xs text-slate-500">稼働</span>
                      <span className="text-base font-semibold tabular-nums text-slate-800">
                        {minutesToHoursDecimal(watchedTasks[i]?.duration ?? 0)}
                        <span className="ml-0.5 text-xs font-normal">h</span>
                      </span>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          className="mt-1 text-left text-xs text-red-600 hover:underline sm:whitespace-nowrap"
                          onClick={() => remove(i)}
                        >
                          この行を削除
                        </button>
                      )}
                    </div>
                  </div>
                  <FieldError
                    message={
                      errs.tasks?.[i]?.startTime?.message as string | undefined
                    }
                  />
                  <FieldError
                    message={
                      errs.tasks?.[i]?.endTime?.message as string | undefined
                    }
                  />
                  <div className="min-w-0">
                    <FieldLabel>内容</FieldLabel>
                    <textarea
                      rows={2}
                      className={fieldTextareaClass}
                      {...form.register(`tasks.${i}.taskDetail`)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1 rounded-md bg-blue-50/80 px-3 py-2 text-slate-800">
            <div className="flex justify-between text-sm">
              <span>タスク合計（稼働）</span>
              <span className="tabular-nums font-medium">
                {taskGrossHours}
                <span className="ml-0.5 font-normal">h</span>
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>休憩</span>
              <span className="tabular-nums font-medium">
                {typeof watchedBreak === "number" && watchedBreak >= 0
                  ? watchedBreak
                  : 1}
                <span className="ml-0.5 font-normal">h</span>
              </span>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="明日の作業予定"
          description="番号・案件名・内容を行で追加できます。手持ち案件タブの内容をドロップダウンから呼び出せます。"
          dense
          className="border-pink-200 bg-pink-100/60 ring-pink-200/60"
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => appendTomorrow(defaultProjectLine())}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              ＋ 行を追加
            </button>
          </div>
          <FieldError message={errs.tomorrowLines?.message as string} />
          <div className="space-y-2">
            {tomorrowFields.map((f, i) => (
              <div
                key={f.id}
                className="rounded-lg border border-pink-200/80 bg-pink-50/70 p-3"
              >
                <p className="mb-2 text-xs font-semibold text-slate-600">
                  行 {i + 1}
                </p>
                <div className="flex flex-col gap-2">
                  <HandheldLinePicker
                    lines={handheldLines}
                    onPick={(line) => {
                      form.setValue(
                        `tomorrowLines.${i}.projectNumber`,
                        line.projectNumber
                      );
                      form.setValue(
                        `tomorrowLines.${i}.projectName`,
                        line.projectName
                      );
                      // 手持ち案件リストから「内容」は廃止
                      form.setValue(`tomorrowLines.${i}.content`, "");
                    }}
                  />
                  <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(5rem,6.5rem)_1fr]">
                    <div className="min-w-0">
                      <FieldLabel className="whitespace-nowrap">
                        番号
                      </FieldLabel>
                      <input
                        maxLength={8}
                        className={`${fieldInputClass} w-full max-w-[6.5rem] px-2 text-center text-sm`}
                        {...form.register(`tomorrowLines.${i}.projectNumber`)}
                      />
                    </div>
                    <div className="min-w-0">
                      <FieldLabel>案件名</FieldLabel>
                      <input
                        type="text"
                        className={fieldInputClass}
                        {...form.register(`tomorrowLines.${i}.projectName`)}
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <FieldLabel>内容</FieldLabel>
                    <textarea
                      rows={2}
                      className={fieldTextareaClass}
                      {...form.register(`tomorrowLines.${i}.content`)}
                    />
                  </div>
                  {tomorrowFields.length > 1 && (
                    <div>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => removeTomorrow(i)}
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

        <FormSection
          title="備考（成果・問題・改善点）"
          description="業務上の成果、課題、次に試したい改善などを自由に記入してください。"
          dense
        >
          <div>
            <FieldLabel>内容</FieldLabel>
            <textarea
              rows={3}
              className={fieldTextareaClass}
              {...form.register("summary")}
            />
          </div>
        </FormSection>

        <FormActions>
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? "保存中…" : submitLabel}
          </PrimaryButton>
          {formActionsExtra}
          <SecondaryButton onClick={() => handlePrint()}>印刷</SecondaryButton>
        </FormActions>
      </form>

      <div
        className="pointer-events-none absolute -left-[9999px] top-0 w-[210mm] bg-white p-4 text-black"
        aria-hidden
      >
        <DailyReportPrintDocument
          report={snapshot}
          contentRef={printRef}
          authorName={authorDisplayName}
          submissionTargetName={submissionTargetDisplayName}
        />
      </div>
    </FormShell>
  );
}
