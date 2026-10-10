// Tab「历史」：这本书做过的每一次任务（哪几页、用时、模型、失败原因），最后一行是加入书库的时间。
// 原来任务记录收在「进度」页底部、概览里还有两行「最近活动」，同一件事说了两遍。
import type { TranslationCoverageView } from "@/platform/api/index.js";
import { formatZhDateTime } from "@/platform/utils/datetime.js";
import { JobHistoryPanel, hasJobHistory } from "../panels/processing/TranslationCoveragePanel.js";

function addedText(value?: string | null): string {
  const raw = `${value || ""}`.trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : formatZhDateTime(parsed);
}

export function BookDetailHistoryTab({
  coverage,
  addedAt = null,
}: {
  coverage: TranslationCoverageView | null;
  addedAt?: string | null;
}) {
  const added = addedText(addedAt);
  return (
    <div className="book-detail-tab-history" data-book-detail-tab="history">
      {hasJobHistory(coverage) ? (
        <JobHistoryPanel coverage={coverage} defaultOpen />
      ) : (
        <p className="book-detail-history-empty">还没有任务记录。</p>
      )}
      {added ? <p className="book-detail-history-added">{added} 加入书库</p> : null}
    </div>
  );
}
