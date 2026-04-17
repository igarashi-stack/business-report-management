import { create } from "zustand";
import { persist } from "zustand/middleware";

type State = {
  /**
   * all = 制限なし（全員がプルダウンに表示）
   * custom = pinnedVisibleUserIds に含まれる ID のみ表示（0 件も可）
   */
  mode: "all" | "custom";
  /**
   * mode=custom のときに有効: ここに含まれる ID のみプルダウンに表示
   */
  pinnedVisibleUserIds: string[];
  togglePinnedVisible: (id: string, allDirectoryUserIds: readonly string[]) => void;
  /** mode=all に戻す（全員表示） */
  showAll: () => void;
  /** mode=custom にして選択を全解除（0人表示） */
  clearAllSelected: () => void;
};

export const useDirectoryVisibilityStore = create<State>()(
  persist(
    (set, get) => ({
      mode: "all",
      pinnedVisibleUserIds: [],
      togglePinnedVisible: (id, allDirectoryUserIds) => {
        const allIds = [...new Set(allDirectoryUserIds)];
        const { mode, pinnedVisibleUserIds: pinned } = get();

        if (mode === "all") {
          // 全員表示中にチェックを外したら「それ以外を表示」= custom へ
          const next = allIds.filter((x) => x !== id);
          set({ mode: "custom", pinnedVisibleUserIds: next });
          return;
        }

        if (pinned.includes(id)) {
          const next = pinned.filter((x) => x !== id);
          set({ pinnedVisibleUserIds: next });
          return;
        }

        // custom 中にチェックしたら追加
        set({ pinnedVisibleUserIds: [...pinned, id] });
      },
      showAll: () => set({ mode: "all", pinnedVisibleUserIds: [] }),
      clearAllSelected: () => set({ mode: "custom", pinnedVisibleUserIds: [] }),
    }),
    {
      name: "brm-directory-pinned-visible",
      version: 2,
      migrate: (persisted) => {
        // v1: { pinnedVisibleUserIds: string[] }（空=全員表示）
        if (
          persisted &&
          typeof persisted === "object" &&
          "pinnedVisibleUserIds" in (persisted as Record<string, unknown>)
        ) {
          const pinned = (persisted as { pinnedVisibleUserIds?: unknown })
            .pinnedVisibleUserIds;
          const ids = Array.isArray(pinned)
            ? pinned.filter((x): x is string => typeof x === "string")
            : [];
          return {
            mode: ids.length > 0 ? "custom" : "all",
            pinnedVisibleUserIds: ids,
          };
        }
        return { mode: "all", pinnedVisibleUserIds: [] };
      },
    }
  )
);
