// BookCard 封面 hover 区的圆形操作钮与图标解析。
// 从 BookCard.tsx 机械拆出，行为不变。

import type * as React from "react";
import { cn } from "@retainpdf/ui/lib/utils";
import type { BookCardAction, LibraryCardItem } from "../../../domain/types.js";

function IconEye(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" width="16" height="16" {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}
function IconLanguages(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" {...props}>
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  );
}
function IconInfo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function resolveActionIcon(icon: BookCardAction["icon"]) {
  if (icon == null || icon === "eye") return <IconEye aria-hidden="true" />;
  if (icon === "languages") return <IconLanguages aria-hidden="true" />;
  if (icon === "info") return <IconInfo aria-hidden="true" />;
  // 自定义 React 节点
  return icon;
}

/**
 * 壳上的单个圆形操作钮(封面 hover 区)。
 * 也可被外部单独 import 复用。
 */
export function BookCardActionButton({
  action,
  item,
  className,
}: {
  action?: BookCardAction | null;
  item?: LibraryCardItem;
  className?: string;
}) {
  const label = `${action?.label || action?.id || "操作"}`.trim();
  return (
    <button
      type="button"
      data-book-card-action={action?.id || ""}
      className={cn(
        "book-card-action-btn pointer-events-auto flex h-10 w-10 items-center justify-center rounded-[var(--btn-radius)] bg-paper/95 text-foreground shadow-md transition hover:bg-paper active:scale-90 disabled:opacity-50",
        action?.className,
        className,
      )}
      title={label}
      aria-label={label}
      disabled={Boolean(action?.disabled)}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (action?.disabled) return;
        action?.onClick?.(event, item);
      }}
    >
      {resolveActionIcon(action?.icon)}
    </button>
  );
}
