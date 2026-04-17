import type { DirectoryUser } from "@/types/models";

/**
 * 従業員一覧で「表示対象」にチェックした人だけに絞る（ドロップダウン用）
 * mode=all は制限なし（全員表示）
 * mode=custom は pinned に含まれる人だけ表示（0 件も可）
 */
export function filterVisibleUsers<T extends { id: string }>(
  users: T[],
  mode: "all" | "custom",
  pinnedVisibleUserIds: readonly string[]
): T[] {
  if (mode === "all") return users;
  const s = new Set(pinnedVisibleUserIds);
  return users.filter((u) => s.has(u.id));
}

/**
 * 選択中の ID は非表示でも含める（提出先・宛先の整合用）
 */
export function mergeUserIfMissing<T extends { id: string; displayName: string; email: string }>(
  options: T[],
  requiredId: string | undefined,
  labelFallback: (id: string) => T
): T[] {
  if (!requiredId) return options;
  if (options.some((u) => u.id === requiredId)) return options;
  return [...options, labelFallback(requiredId)];
}

/** DirectoryUser のフォールバック行 */
export function fallbackUserOption(
  id: string,
  label: string
): DirectoryUser {
  return { id, displayName: label, email: "" };
}
