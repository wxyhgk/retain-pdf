// BookCard 封面上的覆盖层：批量选择态、hover 操作菜单。
// 从 BookCard.tsx 机械拆出，DOM/class 不变。

import type * as React from "react";
import { cn } from "@retainpdf/ui/lib/utils";
import { BookCardActionButton } from "./BookCardActionButton.jsx";
import type { BookCardAction, LibraryCardItem } from "../../../domain/types.js";

function IconCheck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="13" height="13" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

export function BookCardMediaOverlays({
  batchMode,
  selected,
  actions,
  item,
}: {
  batchMode: boolean;
  selected: boolean;
  actions: BookCardAction[];
  item: LibraryCardItem;
}) {
  if (batchMode) {
    return (
      <>
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-[6] transition-colors",
            selected ? "bg-foreground/10" : "bg-transparent",
          )}
          aria-hidden
        />
        <div
          className={cn(
            "absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
            selected
              ? "border-foreground bg-foreground text-background"
              : "border-paper/80 bg-paper/70 text-transparent",
          )}
          aria-hidden
        >
          <IconCheck />
        </div>
      </>
    );
  }

  if (actions.length > 0) {
    return (
      <div className="book-card-actions pointer-events-none absolute inset-0 z-[6] flex items-center justify-center gap-2 bg-scrim/35 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {actions.map((action) => (
          <BookCardActionButton
            key={action.id || action.label}
            action={action}
            item={item}
          />
        ))}
      </div>
    );
  }

  return null;
}
