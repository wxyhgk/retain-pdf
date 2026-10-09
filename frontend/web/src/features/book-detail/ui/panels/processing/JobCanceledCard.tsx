/** 翻译任务被取消后：说明停在哪一步，给「从断点继续」。
 *
 * 以前取消之后「进度」页什么都不说：没有「已取消」，也不知道还能不能接着跑，只剩一个
 * 「重新翻译整本」——取消前已经翻好的部分全部作废、重新付费。后端的续跑计划会沿用
 * 已完成的阶段（以及翻译断点），这里把它摆出来。 */
import { CircleSlash, FileText, LoaderCircle, RotateCcw } from "lucide-react";

import { btn } from "../ui.js";
import type { JobFailurePrimaryAction } from "./JobFailureCard.js";

export type JobCanceledCardProps = {
  /** 停在哪一站（「翻译」「渲染」）；认不出就不写。 */
  stoppedAt?: string;
  primary?: JobFailurePrimaryAction | null;
  notice?: string;
  actionError?: string;
  onOpenLog?: () => void;
};

export function JobCanceledCard({ stoppedAt = "", primary = null, notice = "", actionError = "", onOpenLog }: JobCanceledCardProps) {
  return (
    <section className="book-detail-failure-card" data-tone="cancelled" data-job-cancelled="true" aria-label="任务已取消">
      <header className="book-detail-failure-head">
        <span className="book-detail-failure-icon" aria-hidden="true"><CircleSlash /></span>
        <div className="book-detail-failure-copy">
          <h4>任务已取消</h4>
          {stoppedAt ? <p className="book-detail-failure-subtitle">{`停在${stoppedAt}阶段`}</p> : null}
        </div>
      </header>

      {primary || onOpenLog ? (
        <div className="book-detail-failure-actions">
          {primary ? (
            <button
              type="button"
              id="book-detail-resume-cancelled-btn"
              className={btn("default")}
              disabled={Boolean(primary.pending)}
              onClick={() => void primary.onClick()}
            >
              {primary.pending
                ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                : <RotateCcw className="size-3.5" aria-hidden="true" />}
              <span className="ml-1.5">{primary.pending ? primary.pendingLabel || "提交中…" : primary.label}</span>
            </button>
          ) : null}
          {onOpenLog ? (
            <button type="button" className={btn("outline")} onClick={onOpenLog}>
              <FileText className="size-3.5" aria-hidden="true" />
              <span className="ml-1.5">查看日志</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {primary?.hint ? (
        <p className="book-detail-failure-hint" data-failure-hint="true">{primary.hint}</p>
      ) : notice ? (
        <p className="book-detail-failure-hint" data-failure-notice="true">{notice}</p>
      ) : null}
      {actionError ? (
        <p className="book-detail-failure-detail-error" role="alert">{actionError}</p>
      ) : null}
    </section>
  );
}
