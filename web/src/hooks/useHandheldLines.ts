import { useCallback, useEffect, useState } from "react";
import type { ReportProjectLine } from "@/types/models";
import { useAccessToken } from "@/hooks/useAccessToken";
import { authenticatedFetch } from "@/lib/api/authenticatedFetch";
import {
  defaultHandheldLine,
  handheldSnapshotForReport,
  readHandheldLines,
  writeHandheldLines,
} from "@/lib/storage/handheldProjects";

type PersistedMode = "sharepoint" | "local" | "loading";

/**
 * 「手持ち案件」一覧。
 * `SHAREPOINT_LIST_HANDHELD_PROJECTS_ID` があるときは SharePoint に保存し別端末でも共有。
 * 未設定のときは従来どおりブラウザの localStorage。
 */
export function useHandheldLines(userId: string | undefined) {
  const { getToken } = useAccessToken();
  const [lines, setLines] = useState<ReportProjectLine[]>([
    defaultHandheldLine(),
  ]);
  const [persisted, setPersisted] = useState<PersistedMode>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLines([defaultHandheldLine()]);
      setPersisted("local");
      setLoadError(null);
      return;
    }

    setLines(readHandheldLines(userId));
    setPersisted("loading");
    setLoadError(null);

    let cancelled = false;
    void (async () => {
      try {
        const res = await authenticatedFetch(getToken, "/api/handheld-projects");
        const data = (await res.json()) as {
          lines?: ReportProjectLine[];
          persisted?: "sharepoint" | "local";
          error?: string;
          message?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(data.error ?? "読み込みに失敗しました");
        }
        if (data.persisted === "sharepoint") {
          const fromServer = Array.isArray(data.lines) ? data.lines : [];
          const hasServer =
            handheldSnapshotForReport(fromServer).length > 0;
          const local = readHandheldLines(userId);
          const hasLocal = handheldSnapshotForReport(local).length > 0;
          setLines(
            hasServer
              ? fromServer.length > 0
                ? fromServer
                : [defaultHandheldLine()]
              : hasLocal
                ? local
                : [defaultHandheldLine()]
          );
          setPersisted("sharepoint");
        } else {
          setLines(readHandheldLines(userId));
          setPersisted("local");
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "読み込みに失敗しました"
          );
          setLines(readHandheldLines(userId));
          setPersisted("local");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken, userId]);

  const persist = useCallback(async () => {
    setSaveError(null);
    if (!userId) return;
    if (persisted === "loading") return;
    // 「内容」列は廃止したため、保存時は常に空文字に寄せる（既存データのクレンジングも兼ねる）
    const normalized = lines.map((l) => ({
      projectNumber: l.projectNumber ?? "",
      projectName: l.projectName ?? "",
      content: "",
    }));
    try {
      if (persisted === "sharepoint") {
        const res = await authenticatedFetch(getToken, "/api/handheld-projects", {
          method: "PUT",
          body: JSON.stringify({ lines: normalized }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "保存に失敗しました");
        }
        return;
      }
      writeHandheldLines(userId, normalized);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存に失敗しました");
      throw e;
    }
  }, [userId, lines, persisted, getToken]);

  const reload = useCallback(() => {
    if (!userId) {
      setLines([defaultHandheldLine()]);
      return;
    }
    setPersisted("loading");
    setLines(readHandheldLines(userId));
    void (async () => {
      try {
        const res = await authenticatedFetch(getToken, "/api/handheld-projects");
        const data = (await res.json()) as {
          lines?: ReportProjectLine[];
          persisted?: "sharepoint" | "local";
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "読み込みに失敗しました");
        if (data.persisted === "sharepoint") {
          const fromServer = Array.isArray(data.lines) ? data.lines : [];
          const hasServer =
            handheldSnapshotForReport(fromServer).length > 0;
          const local = readHandheldLines(userId);
          const hasLocal = handheldSnapshotForReport(local).length > 0;
          setLines(
            hasServer
              ? fromServer.length > 0
                ? fromServer
                : [defaultHandheldLine()]
              : hasLocal
                ? local
                : [defaultHandheldLine()]
          );
          setPersisted("sharepoint");
        } else {
          setLines(readHandheldLines(userId));
          setPersisted("local");
        }
        setLoadError(null);
      } catch (e) {
        setLoadError(
          e instanceof Error ? e.message : "読み込みに失敗しました"
        );
        setLines(readHandheldLines(userId));
        setPersisted("local");
      }
    })();
  }, [getToken, userId]);

  return {
    lines,
    setLines,
    persist,
    reload,
    /** SharePoint に保存しているとき true */
    remote: persisted === "sharepoint",
    /** 初回同期の取得中 */
    loading: persisted === "loading",
    loadError,
    saveError,
    clearSaveError: () => setSaveError(null),
  };
}
