"use client";

import type { WorkInstruction } from "@/types/models";
import { DashboardConfirmLink } from "@/components/ui/dashboardConfirmLink";
import { ListSortTh, type ListSortDir } from "@/components/ui/ListSortTh";
import { workStyleLabel } from "@/lib/instruction/workStyleLabel";
import { formatListUpdatedAt, formatSlashDate } from "@/lib/time/formatJa";

export type ReceivedInstructionListSortKey =
  | "counterparty"
  | "workStyle"
  | "targetDate"
  | "updated";

export type ReceivedInstructionTableSortHeader = {
  activeKey: ReceivedInstructionListSortKey;
  dir: ListSortDir;
  onColumnClick: (key: ReceivedInstructionListSortKey) => void;
};

export function ReceivedInstructionsTable({
  items,
  emptyMessage = "受信した業務指示書はまだありません。",
  maxRows,
  unseenIds,
  nameById,
  counterpartyLabel,
  counterpartyId,
  sortHeader,
}: {
  items: WorkInstruction[];
  emptyMessage?: string;
  maxRows?: number;
  unseenIds?: ReadonlySet<string>;
  nameById: Map<string, string>;
  /** 列見出し（受信: 差出人 / 作成: 宛先 など） */
  counterpartyLabel: string;
  /** 行ごとに表示する相手方の Azure AD ID を返す */
  counterpartyId: (w: WorkInstruction) => string;
  /** 列見出しをクリックで並び替え（親が全件ソート済みの `items` を渡す） */
  sortHeader?: ReceivedInstructionTableSortHeader;
}) {
  const rows =
    maxRows != null ? items.slice(0, maxRows) : [...items];

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500">{emptyMessage}</p>
    );
  }

  const thClass = "px-4 py-3";
  const showStatus = Boolean(unseenIds);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
          <tr>
            {showStatus ? (
              <th className="w-16 px-4 py-3 font-medium whitespace-nowrap">
                状態
              </th>
            ) : null}
            {sortHeader ? (
              <>
                <ListSortTh
                  className={thClass}
                  label={counterpartyLabel}
                  active={sortHeader.activeKey === "counterparty"}
                  dir={sortHeader.dir}
                  onClick={() =>
                    sortHeader.onColumnClick("counterparty")
                  }
                />
                <ListSortTh
                  className={thClass}
                  label="勤務形態"
                  active={sortHeader.activeKey === "workStyle"}
                  dir={sortHeader.dir}
                  onClick={() => sortHeader.onColumnClick("workStyle")}
                />
                <ListSortTh
                  className={thClass}
                  label="対象日"
                  active={sortHeader.activeKey === "targetDate"}
                  dir={sortHeader.dir}
                  onClick={() => sortHeader.onColumnClick("targetDate")}
                />
                <ListSortTh
                  className={thClass}
                  label="更新日"
                  active={sortHeader.activeKey === "updated"}
                  dir={sortHeader.dir}
                  onClick={() => sortHeader.onColumnClick("updated")}
                />
              </>
            ) : (
              <>
                <th className={`${thClass} font-medium`}>
                  {counterpartyLabel}
                </th>
                <th className={`${thClass} font-medium`}>勤務形態</th>
                <th className={`${thClass} font-medium`}>対象日</th>
                <th className={`${thClass} font-medium`}>更新日</th>
              </>
            )}
            <th className={`w-28 ${thClass} font-medium`} />
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => {
            const cp = counterpartyId(w);
            const cpName =
              nameById.get(cp) ?? (cp ? `${cp.slice(0, 8)}…` : "—");
            return (
              <tr key={w.id} className="border-b border-slate-100">
                {showStatus ? (
                  <td className="px-4 py-3">
                    {unseenIds?.has(w.id) ? (
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center rounded bg-red-100 text-[12px] font-bold text-red-700"
                        aria-label="未読"
                        title="未読"
                      >
                        未
                      </span>
                    ) : null}
                  </td>
                ) : null}
                <td className="px-4 py-3">{cpName}</td>
                <td className="px-4 py-3">{workStyleLabel(w.workStyle)}</td>
                <td className="px-4 py-3 tabular-nums text-slate-800">
                  {formatSlashDate(w.targetDate || "")}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-800">
                  {formatListUpdatedAt(w.createdAt ?? "", w.submittedAt ?? "")}
                </td>
                <td className="px-4 py-3">
                  <DashboardConfirmLink href={`/instructions/${w.id}/edit`} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {maxRows != null && items.length > maxRows ? (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          直近 {maxRows} 件を表示しています（全 {items.length} 件）。
        </p>
      ) : null}
    </div>
  );
}
