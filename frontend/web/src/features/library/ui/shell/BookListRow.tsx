// 书架列表视图的行(照搬 PDF_MD_lib 的 BookListRow):小封面缩略图 + 标题/副标题/
// 更新日期 + 右侧眼睛(快速阅读)。点行 → 书籍详情弹窗。数据/动作与卡片一致。

import { memo } from "react";
import { cn } from "@/ui/lib/utils";
import { cardSignatureOf } from "./BookCard.jsx";
import { isLibraryCardProcessing, libraryCardBadge } from "../../domain/card/library-card-badge.js";
import { BadgeIcon } from "../display/library-card-badge-icon.jsx";
import { BookCardProcessingOverlay } from "../display/BookCardProcessingOverlay.jsx";
import { useRecentJobCover } from "../display/useRecentJobCover.js";
import { resolveLibraryReadPresentation } from "../../domain/card/library-card-semantics.js";
import type { LibraryCardItem } from "../../domain/types.js";
import {
  recentJobTitle,
} from "../../domain/card/recent-job-card-presenter.js";

function formatDate(value: string | null | undefined) {
  const raw = `${value || ""}`.trim();
  if (!raw) return "—";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "numeric", day: "numeric" }).format(parsed);
}

type BookListRowProps = {
  item: LibraryCardItem;
  onOpenDetail?: (item: LibraryCardItem) => void;
  onReader?: (jobId: string, documentId?: string) => void;
  onReadSource?: (documentId: string) => void;
  onSelect?: (jobId: string) => void;
  batchMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (documentId: string) => void;
};

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" width="15" height="15">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}
function IconFile() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" width="18" height="18">
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v4h4" />
    </svg>
  );
}
function IconCheck(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="12" height="12" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

/**
 * memo 比较：与 BookCard 同策略——回调引用比对 + item 展示签名（cardSignatureOf）比对；
 * 行无 actions（仅固定眼睛钮），故不比 actions。
 */
function areEqual(prev: BookListRowProps, next: BookListRowProps) {
  return prev.onOpenDetail === next.onOpenDetail
    && prev.onReader === next.onReader
    && prev.onReadSource === next.onReadSource
    && prev.onSelect === next.onSelect
    && prev.batchMode === next.batchMode
    && prev.selected === next.selected
    && prev.onToggleSelect === next.onToggleSelect
    && cardSignatureOf(prev.item) === cardSignatureOf(next.item);
}

function BookListRowImpl({
  item,
  onOpenDetail,
  onReader,
  onReadSource,
  onSelect,
  batchMode = false,
  selected = false,
  onToggleSelect,
}: BookListRowProps) {
  const documentId = `${item.document_id || ""}`.trim();
  const jobId = `${item.job_id || ""}`.trim();
  const title = recentJobTitle(item);
  const fullTitle = item.title || item.display_name || item.job_id || "-";
  const pageCount = item.page_count || "-";
  const readPresentation = resolveLibraryReadPresentation(item);
  const badge = libraryCardBadge(item);
  const processing = isLibraryCardProcessing(item);
  const coverUrl = useRecentJobCover(item);

  function open() {
    if (batchMode) {
      if (documentId) onToggleSelect?.(documentId);
      return;
    }
    // 优先详情弹窗（处理 Tab 内嵌进度）；不走旧工作流弹窗
    if (onOpenDetail && (documentId || jobId)) {
      onOpenDetail(item);
      return;
    }
    if (jobId) onSelect?.(jobId);
  }
  function handleClick(event) {
    if (event.target?.closest?.("button")) return;
    event.preventDefault();
    open();
  }
  function handleKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target?.closest?.("button")) return;
    event.preventDefault();
    open();
  }
  function handleEye(event) {
    event.preventDefault();
    event.stopPropagation();
    if (readPresentation.target === "job") {
      onReader?.(readPresentation.jobId, readPresentation.documentId);
      return;
    }
    if (readPresentation.target === "source") {
      onReadSource?.(readPresentation.documentId);
    }
  }

  return (
    <div
      className="recent-job-item group flex w-full cursor-pointer items-start gap-4 rounded-2xl px-3 py-3.5 text-left shadow-[0_1px_0_color-mix(in_srgb,var(--shadow-color)_4%,transparent)] transition duration-150 ease-[var(--ease-out)] hover:bg-muted/45 active:scale-[0.99] sm:px-4"
      role="button"
      tabIndex={0}
      data-job-id={item.job_id || ""}
      data-document-id={item.document_id || ""}
      data-library-only={item.library_only ? "true" : "false"}
      data-status={item.status || ""}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {batchMode ? (
        <div className={cn(
          "mt-1 flex h-5 w-5 shrink-0 items-center justify-center self-start rounded-full border transition-colors",
          selected ? "border-foreground bg-foreground text-background" : "border-border bg-paper text-transparent",
        )} aria-hidden>
          <IconCheck />
        </div>
      ) : null}

      <div className={cn("relative aspect-[3/4] w-11 shrink-0 overflow-hidden rounded-xl bg-paper shadow-[0_2px_10px_color-mix(in_srgb,var(--shadow-color)_6%,transparent)] sm:w-12", batchMode && selected && "ring-2 ring-foreground ring-offset-2")}>
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-full w-full bg-paper object-contain" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted/60 to-background text-muted-foreground/45"><IconFile /></div>
        )}
        {processing ? <BookCardProcessingOverlay compact /> : null}
        {badge && !processing ? (
          <div className="pointer-events-none absolute right-0.5 top-0.5 z-[2] max-w-[none]">
            <span
              className={cn(
                "book-card-status-badge inline-flex h-4 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full pl-1 pr-1.5 text-[9px] font-medium leading-none shadow-sm",
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
      </div>

      <div className="relative min-w-0 flex-1 pr-2 pt-0.5">
        <h3 className="recent-job-id line-clamp-2 min-w-0 text-sm font-semibold leading-snug text-foreground" title={fullTitle}>{title}</h3>
        <p className="mt-2 text-[11px] tabular-nums text-muted-foreground/55">{pageCount} 页 · 更新 {formatDate(item.updated_at)}</p>
      </div>

      {batchMode ? null : (
        <div className="flex shrink-0 items-center self-center">
          <button
            type="button"
            className="recent-job-reader flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 text-foreground transition hover:bg-muted active:scale-90"
            title={readPresentation.label}
            aria-label={readPresentation.label}
            onClick={handleEye}
          >
            <IconEye />
          </button>
        </div>
      )}
    </div>
  );
}

export const BookListRow = memo(BookListRowImpl, areEqual);
