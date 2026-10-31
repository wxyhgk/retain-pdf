// 「进度」页细节区的「活动」：任务各步的时间线，在跑的那一条是后端的实时说明。
// 以前挂在流水线画面下面，和失败卡、编辑部画面各占一块；现在三者是细节区的三页。
// 总用时在状态行的小字里，这里不再写一遍。契约：根节点 data-line-activity。

import type { LibraryCardItem } from "@/features/library/domain.js";
import { recentActivity, type JobTimeline } from "../../../domain/assembly-line-model.js";

export type ProcessingActivityProps = {
  item?: LibraryCardItem;
  timeline?: JobTimeline | null;
  jobActive?: boolean;
  loading?: boolean;
};

/** 有没有可列的活动：细节区据此决定要不要这一页。 */
export function activityLinesOf({ item = {}, timeline = null, jobActive = false, loading = false }: ProcessingActivityProps) {
  if (loading) return [];
  const liveDetail = jobActive ? `${item.stage_snapshot?.stage_detail || item.stage_detail || ""}` : "";
  return recentActivity(timeline, { liveDetail });
}

export function ProcessingActivity(props: ProcessingActivityProps) {
  const { jobActive = false } = props;
  const lines = activityLinesOf(props);
  if (!lines.length) return null;
  return (
    <div className="book-detail-line-activity" data-line-activity="true">
      <ol>
        {lines.map((line, index) => (
          <li key={line.key} className={index === 0 && jobActive ? "is-latest" : undefined}>
            <span className="book-detail-line-activity-dot" aria-hidden="true" />
            <span className="book-detail-line-activity-text">{line.text}</span>
            {line.at ? <time>{line.at}</time> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
