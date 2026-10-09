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
//
// 机械拆分(行为/DOM/class 不变):
//   - ./book-card/format.ts                日期与展示签名
//   - ./book-card/BookCardActionButton.tsx 操作钮与图标
//   - ./book-card/BookCardCover.tsx        封面/徽标/进度覆盖层
//   - ./book-card/BookCardMediaOverlays.tsx 批量选择与 hover 操作菜单

import { memo } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { cn } from "@retainpdf/ui/lib/utils";
import { isLibraryCardProcessing, libraryCardBadge } from "../../domain/card/library-card-badge.js";
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
import { cardSignatureOf, formatCardDate } from "./book-card/format.js";
import { BookCardCover } from "./book-card/BookCardCover.jsx";
import { BookCardMediaOverlays } from "./book-card/BookCardMediaOverlays.jsx";

export { cardSignatureOf } from "./book-card/format.js";
export { BookCardActionButton } from "./book-card/BookCardActionButton.jsx";

const renderCountsForTests = new Map<string, number>();
export function getCardRenderCountForTests(jobId?: string | null) {
  return renderCountsForTests.get(`${jobId || ""}`) || 0;
}
export function resetCardRenderCountsForTests() {
  renderCountsForTests.clear();
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

  // EventTarget 类型上没有 closest；点击目标实际都是 Element，这里只做类型收窄，保持原来的可选调用。
  function handleCardClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as Element | null)?.closest?.("button")) return;
    event.preventDefault();
    openTarget();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    if ((event.target as Element | null)?.closest?.("button")) return;
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
        <BookCardCover
          coverUrl={coverUrl}
          badge={badge}
          processing={processing}
          percent={percent}
        />
        <BookCardMediaOverlays
          batchMode={batchMode}
          selected={selected}
          actions={actions}
          item={item}
        />
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
