// BookCard 封面区：封面图 / PDF 占位、状态徽标、处理中 loading 与底部进度条。
// 从 BookCard.tsx 机械拆出，DOM/class 不变。

import type * as React from "react";
import { cn } from "@retainpdf/ui/lib/utils";
import { BadgeIcon } from "../../display/library-card-badge-icon.jsx";
import { BookCardProcessingOverlay } from "../../display/BookCardProcessingOverlay.jsx";
import type { LibraryCardBadge } from "../../../domain/types.js";

function IconFile(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" width="34" height="34" {...props}>
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
    </svg>
  );
}

export function BookCardCover({
  coverUrl,
  badge,
  processing,
  percent,
}: {
  coverUrl?: string | null;
  badge?: LibraryCardBadge | null;
  processing: boolean;
  percent: number;
}) {
  return (
    <>
      {coverUrl ? (
        <img src={coverUrl} alt="" className="h-full w-full bg-paper object-contain" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted/60 to-background text-muted-foreground/50">
          <IconFile aria-hidden="true" />
          <span className="text-[10px] text-muted-foreground/60">PDF</span>
        </div>
      )}

      {/* 进行中：封面中央 loading，不在右上角写 OCR/翻译/渲染（易截断） */}
      {processing ? <BookCardProcessingOverlay /> : null}

      {/* 右上角终态/馆藏：禁止 truncate/flex 收缩，否则「已翻译」会被裁成省略号 */}
      {badge && !processing ? (
        <div className="pointer-events-none absolute right-2 top-2 z-10 max-w-[none]">
          <span
            className={cn(
              "book-card-status-badge inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full pl-1.5 pr-2 text-[10px] font-medium leading-none shadow-sm",
              badge.cls,
            )}
            data-badge-label={badge.label}
            data-badge-icon={badge.icon}
          >
            <BadgeIcon name={badge.icon} />
            <span className="shrink-0 whitespace-nowrap">{badge.label}</span>
          </span>
        </div>
      ) : null}

      {processing && Number.isFinite(percent) ? (
        <div className="absolute inset-x-0 bottom-0 z-10 h-1 bg-scrim/15">
          <div
            className="h-full bg-primary transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
    </>
  );
}
