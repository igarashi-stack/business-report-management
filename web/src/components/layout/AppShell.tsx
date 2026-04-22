"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMsal } from "@azure/msal-react";
import { DevImpersonationBar } from "@/components/dev/DevImpersonationBar";
import { useSessionStore } from "@/store/sessionStore";
import type { ReactNode } from "react";
import { ConfirmLink } from "@/components/ui/ConfirmLink";
import {
  InstructionDocumentIcon,
  ReportDocumentIcon,
} from "@/components/ui/DocumentTypeIcons";

const navLinks = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/reports", label: "業務報告書" },
  { href: "/instructions", label: "業務指示書" },
  { href: "/employees", label: "従業員一覧" },
] as const;

const devNavLink = {
  href: "/dev/seed-dummy",
  label: "開発（SharePoint）",
} as const;

function isNavLinkActive(pathname: string, href: string): boolean {
  if (href === "/reports") {
    return pathname === "/reports" || pathname.startsWith("/reports/");
  }
  if (href === "/instructions") {
    return (
      pathname === "/instructions" || pathname.startsWith("/instructions/")
    );
  }
  if (href === "/employees") {
    return pathname === "/employees";
  }
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/";
  }
  if (href === "/dev/seed-dummy") {
    return pathname === "/dev/seed-dummy";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const user = useSessionStore((s) => s.user);
  const { instance } = useMsal();
  const showDevNav =
    typeof process.env.NODE_ENV !== "undefined" &&
    process.env.NODE_ENV === "development";

  async function logout() {
    await instance.logoutPopup({
      account: instance.getActiveAccount() ?? undefined,
    });
    useSessionStore.getState().setUser(null);
    useSessionStore.getState().setSessionError(null);
    useSessionStore.getState().setImpersonateUserId(null);
    useSessionStore.getState().setDevImpersonation(null);
    window.location.href = "/login";
  }

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold text-zinc-800">
              業務報告・指示
            </Link>
            <nav className="flex flex-wrap gap-3 text-sm">
              {navLinks.map((l) => {
                const active = isNavLinkActive(pathname, l.href);
                return (
                  <ConfirmLink
                    key={l.href}
                    href={l.href}
                    className={
                      active
                        ? "inline-flex items-center gap-1.5 font-medium text-blue-700"
                        : "inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-900"
                    }
                  >
                    {l.href === "/reports" ? (
                      <ReportDocumentIcon
                        className="h-4 w-4 shrink-0 text-sky-600"
                        aria-hidden
                      />
                    ) : l.href === "/instructions" ? (
                      <InstructionDocumentIcon
                        className="h-4 w-4 shrink-0 text-amber-600"
                        aria-hidden
                      />
                    ) : null}
                    {l.label}
                  </ConfirmLink>
                );
              })}
              {showDevNav ? (
                <ConfirmLink
                  href={devNavLink.href}
                  className={
                    isNavLinkActive(pathname, devNavLink.href)
                      ? "inline-flex items-center gap-1.5 font-medium text-violet-700"
                      : "inline-flex items-center gap-1.5 text-violet-600 hover:text-violet-900"
                  }
                >
                  {devNavLink.label}
                </ConfirmLink>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <span>{user?.displayName}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-50"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>
      <DevImpersonationBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
