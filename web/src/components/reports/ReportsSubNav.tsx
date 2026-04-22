"use client";

import { ConfirmLink } from "@/components/ui/ConfirmLink";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/reports", label: "一覧・作成" },
  { href: "/reports/backlog", label: "手持ち案件" },
] as const;

function tabActive(pathname: string, href: string): boolean {
  if (href === "/reports") {
    return (
      pathname === "/reports" ||
      pathname.startsWith("/reports/new") ||
      /^\/reports\/[^/]+\/edit$/.test(pathname)
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ReportsSubNav() {
  const pathname = usePathname();

  return (
    <nav
      className="-mx-1 flex gap-1 border-b border-zinc-200 pb-px"
      aria-label="業務報告書のサブナビ"
    >
      {tabs.map((t) => {
        const active = tabActive(pathname, t.href);
        return (
          <ConfirmLink
            key={t.href}
            href={t.href}
            className={
              active
                ? "rounded-t-md border border-b-0 border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-blue-700"
                : "rounded-t-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }
          >
            {t.label}
          </ConfirmLink>
        );
      })}
    </nav>
  );
}
