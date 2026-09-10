// BookCard —— 图书馆一等 UI 组件：纯「壳」。
//
// 壳负责:
//   - 封面 / 占位 / 状态徽标 / 进度条
//   - 标题 + 副标题
//   - 点卡片本体 → 打开详情(或批量选中)
//   - hover 遮罩上渲染 actions 按钮列表
//
// 壳不负责:
//   - 决定有哪些按钮、按钮干什么(由 props.actions 注入)
//   - 翻译 / 删除 / 合集等业务(放在 action.onClick 或 BookDetail)
//
// 默认按钮见 ../actions/ → buildDefaultBookCardActions。
// 加按钮 = 调用方拼更大的 actions 数组,不必改本文件。

import { memo } from "react";
import { cn } from "@retainpdf/ui/lib/utils";
import { isLibraryCardProcessing, libraryCardBadge } from "../../domain/card/library-card-badge.js";
import { BadgeIcon } from "../display/library-card-badge-icon.jsx";
import { BookCardProcessingOverlay } from "../display/BookCardProcessingOverlay.jsx";
import { useRecentJobCover } from "../display/useRecentJobCover.js";
import {
  bookCardActionsSignature,
  buildDefaultBookCardActions,
} from "../../domain/actions/index.js";
import type { BookCardAction, LibraryCardItem } from "../../domain/types.js";
import {
  isRecentJobActive,
  recentJobProgressPercent,
  recentJobTitle,
} from "../../domain/card/recent-job-card-presenter.js";
import {
  isLibraryOnlyItem,
} from "../../domain/documents/document-card-item.js";

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

/**
 * memo / 列表行共用：item 展示签名（命中才重渲）。
 * 身份：job_id/document_id/workflow/job_type/library_only/reading_status —— 决定点卡进详情还是切选中态。
 * 时间：updated_at —— 卡片副标题日期。
 * 状态三件套：status（后端终态 succeeded/failed/canceled/running…）/ stage（列表投影原生 stage，live.rs 无 display_stage）/ display_stage（轮询·lane 合并后的公开阶段）/ substage（阶段内细分）。
 * 进度：progress.*（顶层）+ runtime_status.progress.*（轮询快照）—— 驱动中央 loading 与底部进度条。
 * 展示：title/display_name/page_count/cover_url/thumbnail_url/stage_detail/runtime_status.detail —— 标题·页数·封面·副文案。
 */
export function cardSignatureOf(item: LibraryCardItem = {}) {
  const progress = item.progress && typeof item.progress === "object" ? item.progress : {};
  const runtimeProgress =
    item.runtime_status?.progress && typeof item.runtime_status.progress === "object"
      ? item.runtime_status.progress
      : {};
  return [
    item.job_id,
    item.document_id,
    item.workflow,
    item.job_type,
    item.library_only ? "lib" : "",
    item.reading_status,
    item.updated_at,
    item.status,
    item.stage,
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

/**
 * memo 比较：回调引用比对（onSelect/onOpenDetail/…）+ actions 指纹比对（id/label/disabled，不比 onClick 闭包）
 * + item 展示签名比对；签名命中即跳过重渲，行为不变。
 */
function areBookCardPropsEqual(prev: BookCardProps, next: BookCardProps) {
  return (
    prev.onSelect === next.onSelect &&
    prev.onOpenDetail === next.onOpenDetail &&
    prev.batchMode === next.batchMode &&
    prev.selected === next.selected &&
    prev.onToggleSelect === next.onToggleSelect &&
    // 兼容旧 props:未显式传 actions 时仍比 onReader/onReadSource
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
  onReader?: (jobId: string, documentId?: string) => void;
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
    // 优先书籍详情（含运行中进度 Tab）；不再用 selectJob 弹旧工作流窗
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
          {pageCount} 页 · {updatedAt}
        </p>
      </div>
    </div>
  );
}

export const BookCard = memo(BookCardImpl, areBookCardPropsEqual);

// 工厂 re-export：阅读 / 翻译各自独立模块，见 book-card-actions/
export {
  BOOK_CARD_ACTION_READ,
  BOOK_CARD_ACTION_TRANSLATE,
  buildReadBookCardAction,
  buildTranslateBookCardAction,
  buildDefaultBookCardActions,
  buildShelfBookCardActions,
  bookCardActionsSignature,
} from "../../domain/actions/index.js";
