// BookCard — thành phần UI hạng nhất của thư viện: "vỏ" thuần.
//
// Vỏ chịu trách nhiệm:
//   - bìa / chỗ trống / huy hiệu trạng thái / thanh tiến trình
//   - tiêu đề + phụ đề
//   - bấm thân thẻ → mở chi tiết (hoặc chọn hàng loạt)
//   - che hover render danh sách nút hành động
//
// Vỏ không chịu trách nhiệm:
//   - quyết định có nút nào, nút làm gì (do props.actions tiêm vào)
//   - nghiệp vụ dịch / xóa / bộ sưu tập (đặt trong action.onClick hoặc BookDetail)
//
// Nút mặc định xem ../actions/ → buildDefaultBookCardActions.
// Thêm nút = phía gọi ghép mảng actions lớn hơn, không cần sửa file này.

import { memo } from "react";
import { cn } from "@/lib/utils";
import { isLibraryCardProcessing, libraryCardBadge } from "../display/library-card-badge.js";
import { BadgeIcon } from "../display/library-card-badge-icon.jsx";
import { BookCardProcessingOverlay } from "../display/BookCardProcessingOverlay.jsx";
import { useRecentJobCover } from "../display/useRecentJobCover.js";
import {
  bookCardActionsSignature,
  buildDefaultBookCardActions,
} from "../actions/index.js";
import type { BookCardAction, LibraryCardItem } from "../types.js";
import {
  isRecentJobActive,
  recentJobProgressPercent,
  recentJobTitle,
  isLibraryOnlyItem,
} from "../../../composition/external.js";

function formatCardDate(value: string | null | undefined) {
  const raw = `${value || ""}`.trim();
  if (!raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

/** memo / dùng chung hàng danh sách: chữ ký trình bày item (tiến trình và tiêu đề đổi mới render lại) */
export function cardSignatureOf(item: LibraryCardItem = {}) {
  const progress = item.progress && typeof item.progress === "object" ? item.progress : {};
  const runtimeProgress =
    item.runtime_status?.progress && typeof item.runtime_status.progress === "object"
      ? item.runtime_status.progress
      : {};
  return [
    item.job_id,
    item.document_id,
    item.library_only ? "lib" : "",
    item.reading_status,
    item.updated_at,
    item.status,
    item.display_stage,
    item.substage,
    progress.current,
    progress.total,
    progress.percent,
    runtimeProgress.current,
    runtimeProgress.total,
    runtimeProgress.percent,
    item.title,
    item.display_name,
    item.page_count,
    item.cover_url,
    item.thumbnail_url,
    item.stage_detail,
    item.runtime_status?.detail,
  ]
    .map((value) => `${value ?? ""}`)
    .join("|");
}

const renderCountsForTests = new Map<string, number>();
export function getCardRenderCountForTests(jobId?: string | null) {
  return renderCountsForTests.get(`${jobId || ""}`) || 0;
}
export function resetCardRenderCountsForTests() {
  renderCountsForTests.clear();
}

function IconEye(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" width="16" height="16" {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}
function IconLanguages(props) {
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
function IconInfo(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconFile(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" width="34" height="34" {...props}>
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
    </svg>
  );
}
function IconCheck(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="13" height="13" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

function resolveActionIcon(icon) {
  if (icon == null || icon === "eye") return <IconEye aria-hidden="true" />;
  if (icon === "languages") return <IconLanguages aria-hidden="true" />;
  if (icon === "info") return <IconInfo aria-hidden="true" />;
  // Nút React tùy biến
  return icon;
}

/**
 * Nút thao tác tròn đơn lẻ trên vỏ (vùng hover của bìa).
 * Cũng có thể được import riêng từ bên ngoài để tái sử dụng.
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
  const label = `${action?.label || action?.id || "Thao tác"}`.trim();
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

function areBookCardPropsEqual(prev: BookCardProps, next: BookCardProps) {
  return (
    prev.onSelect === next.onSelect &&
    prev.onOpenDetail === next.onOpenDetail &&
    prev.batchMode === next.batchMode &&
    prev.selected === next.selected &&
    prev.onToggleSelect === next.onToggleSelect &&
    // Tương thích prop cũ: không truyền actions tường minh vẫn so onReader/onReadSource
    prev.onReader === next.onReader &&
    prev.onReadSource === next.onReadSource &&
    bookCardActionsSignature(prev.actions) === bookCardActionsSignature(next.actions) &&
    cardSignatureOf(prev.item) === cardSignatureOf(next.item)
  );
}

type BookCardProps = {
  item: LibraryCardItem;
  actions?: BookCardAction[];
  onSelect?: (jobId: string) => void;
  onOpenDetail?: (item: LibraryCardItem) => void;
  onReader?: (jobId: string) => void;
  onReadSource?: (documentId: string) => void;
  batchMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (documentId: string) => void;
};

function BookCardImpl({
  item,
  actions: actionsProp,
  onSelect,
  onOpenDetail,
  onReader,
  onReadSource,
  batchMode = false,
  selected = false,
  onToggleSelect,
}: BookCardProps) {
  const libraryOnly = isLibraryOnlyItem(item);
  const documentId = `${item.document_id || ""}`.trim();
  const jobId = `${item.job_id || ""}`.trim();
  const active = isRecentJobActive(item);
  const title = recentJobTitle(item);
  const fullTitle = item.title || item.display_name || item.job_id || "-";
  const pageCount = item.page_count || "-";
  const updatedAt = formatCardDate(item.updated_at);
  const badge = libraryCardBadge(item);
  const processing = isLibraryCardProcessing(item);
  const percent = active ? recentJobProgressPercent(item) : NaN;

  renderCountsForTests.set(jobId, (renderCountsForTests.get(jobId) || 0) + 1);
  const coverUrl = useRecentJobCover(item);

  const actions = Array.isArray(actionsProp)
    ? actionsProp
    : buildDefaultBookCardActions(item, { onReader, onReadSource });

  function openTarget() {
    if (batchMode) {
      if (documentId) onToggleSelect?.(documentId);
      return;
    }
    // Ưu tiên chi tiết sách (kèm Tab tiến trình đang chạy); không dùng selectJob mở
    // cửa sổ workflow cũ nữa
    if (onOpenDetail && (documentId || jobId)) {
      onOpenDetail(item);
      return;
    }
    if (jobId) onSelect?.(jobId);
  }

  function handleCardClick(event) {
    if (event.target?.closest?.("button")) return;
    event.preventDefault();
    openTarget();
  }

  function handleKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target?.closest?.("button")) return;
    event.preventDefault();
    openTarget();
  }

  return (
    <div
      className="book-card recent-job-item group text-left transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.99]"
      role="button"
      tabIndex={0}
      data-book-card="true"
      data-job-id={item.job_id || ""}
      data-document-id={item.document_id || ""}
      data-library-only={libraryOnly ? "true" : "false"}
      data-status={item.status || ""}
      data-updated-at={item.updated_at || ""}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      <div
        className={cn(
          "relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-muted/40 shadow-[0_2px_16px_color-mix(in_srgb,var(--shadow-color)_7%,transparent)] transition-[transform,box-shadow] duration-200 ease-[var(--ease-out)]",
          !batchMode &&
            "group-hover:-translate-y-0.5 group-hover:shadow-[0_8px_28px_color-mix(in_srgb,var(--shadow-color)_12%,transparent)]",
          !batchMode &&
            "group-focus-within:-translate-y-0.5 group-focus-within:shadow-[0_8px_28px_color-mix(in_srgb,var(--shadow-color)_12%,transparent)]",
          batchMode && selected && "ring-2 ring-foreground ring-offset-2",
        )}
      >
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-full w-full bg-paper object-contain" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted/60 to-background text-muted-foreground/50">
            <IconFile aria-hidden="true" />
            <span className="text-[10px] text-muted-foreground/60">PDF</span>
          </div>
        )}

        {/* Đang chạy: loading giữa bìa, không ghi OCR/dịch/render ở góc phải (dễ bị cắt) */}
        {processing ? <BookCardProcessingOverlay /> : null}

        {/* Trạng thái cuối/lưu trữ ở góc phải: cấm truncate/flex shrink, nếu không
            "Đã dịch" sẽ bị cắt thành dấu ba chấm */}
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

        {batchMode ? (
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
        ) : actions.length > 0 ? (
          <div className="book-card-actions pointer-events-none absolute inset-0 z-[6] flex items-center justify-center gap-2 bg-scrim/35 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {actions.map((action) => (
              <BookCardActionButton
                key={action.id || action.label}
                action={action}
                item={item}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex flex-col gap-0.5">
        <h3
          className="book-card-title recent-job-id line-clamp-2 text-xs font-semibold leading-snug text-foreground transition-colors group-hover:text-primary"
          title={fullTitle}
        >
          {title}
        </h3>
        <p className="book-card-meta recent-job-real-id line-clamp-1 text-[10px] text-muted-foreground">
          {pageCount} trang · {updatedAt}
        </p>
      </div>
    </div>
  );
}

export const BookCard = memo(BookCardImpl, areBookCardPropsEqual);

// Tái xuất nhà máy: đọc / dịch mỗi module riêng, xem book-card-actions/
export {
  BOOK_CARD_ACTION_READ,
  BOOK_CARD_ACTION_TRANSLATE,
  buildReadBookCardAction,
  buildTranslateBookCardAction,
  buildDefaultBookCardActions,
  buildShelfBookCardActions,
  bookCardActionsSignature,
} from "../actions/index.js";
