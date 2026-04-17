"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type SeenMap = Record<string, number>;

type UserSeen = {
  reports: SeenMap;
  instructions: SeenMap;
};

type State = {
  byUser: Record<string, UserSeen>;
  markReportSeen: (userId: string, reportId: string, atMs?: number) => void;
  markInstructionSeen: (
    userId: string,
    instructionId: string,
    atMs?: number
  ) => void;
  getReportSeenAt: (userId: string, reportId: string) => number | null;
  getInstructionSeenAt: (userId: string, instructionId: string) => number | null;
};

function normalizeUserId(userId: string): string {
  return String(userId ?? "").trim().toLowerCase();
}

function ensureUser(prev: State["byUser"], userIdRaw: string): UserSeen {
  const userId = normalizeUserId(userIdRaw);
  return (
    prev[userId] ?? {
      reports: {},
      instructions: {},
    }
  );
}

export const useSeenStore = create<State>()(
  persist(
    (set, get) => ({
      byUser: {},
      markReportSeen: (userIdRaw, reportIdRaw, atMs) => {
        const userId = normalizeUserId(userIdRaw);
        const reportId = String(reportIdRaw ?? "").trim();
        if (!userId || !reportId) return;
        const now = typeof atMs === "number" ? atMs : Date.now();
        set((s) => {
          const current = ensureUser(s.byUser, userId);
          return {
            byUser: {
              ...s.byUser,
              [userId]: {
                ...current,
                reports: {
                  ...current.reports,
                  [reportId]: now,
                },
              },
            },
          };
        });
      },
      markInstructionSeen: (userIdRaw, instructionIdRaw, atMs) => {
        const userId = normalizeUserId(userIdRaw);
        const instructionId = String(instructionIdRaw ?? "").trim();
        if (!userId || !instructionId) return;
        const now = typeof atMs === "number" ? atMs : Date.now();
        set((s) => {
          const current = ensureUser(s.byUser, userId);
          return {
            byUser: {
              ...s.byUser,
              [userId]: {
                ...current,
                instructions: {
                  ...current.instructions,
                  [instructionId]: now,
                },
              },
            },
          };
        });
      },
      getReportSeenAt: (userIdRaw, reportIdRaw) => {
        const userId = normalizeUserId(userIdRaw);
        const reportId = String(reportIdRaw ?? "").trim();
        if (!userId || !reportId) return null;
        const u = get().byUser[userId];
        const v = u?.reports?.[reportId];
        return typeof v === "number" ? v : null;
      },
      getInstructionSeenAt: (userIdRaw, instructionIdRaw) => {
        const userId = normalizeUserId(userIdRaw);
        const instructionId = String(instructionIdRaw ?? "").trim();
        if (!userId || !instructionId) return null;
        const u = get().byUser[userId];
        const v = u?.instructions?.[instructionId];
        return typeof v === "number" ? v : null;
      },
    }),
    { name: "brm-seen-items", version: 1 }
  )
);

