import type { ComponentProps, ReactNode } from "react";
import { ConfirmLink } from "@/components/ui/ConfirmLink";

/** 一覧・ダッシュボードの「確認」（業務報告書一覧と同じ薄いトーン） */
const className =
  "inline-flex items-center justify-center rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-sm font-medium text-blue-800 no-underline hover:bg-blue-100";

/** 業務報告書／業務指示書まわりの「確認」リンク */
export function DashboardConfirmLink({
  children = "確認",
  ...props
}: Omit<ComponentProps<typeof ConfirmLink>, "className"> & {
  children?: ReactNode;
}) {
  return (
    <ConfirmLink {...props} className={className}>
      {children}
    </ConfirmLink>
  );
}
