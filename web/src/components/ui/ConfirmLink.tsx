"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useUnsavedChangesStore } from "@/store/unsavedChangesStore";

const DEFAULT_MESSAGE =
  "保存されていない変更があります。画面を移動すると入力内容が失われます。\n移動しますか？";

export function ConfirmLink({
  children = "確認",
  confirmMessage = DEFAULT_MESSAGE,
  ...props
}: Omit<ComponentProps<typeof Link>, "onClick"> & {
  children?: ReactNode;
  confirmMessage?: string;
}) {
  const dirty = useUnsavedChangesStore((s) => s.dirty);
  return (
    <Link
      {...props}
      onClick={(e) => {
        if (!dirty) return;
        if (!confirm(confirmMessage)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {children}
    </Link>
  );
}

