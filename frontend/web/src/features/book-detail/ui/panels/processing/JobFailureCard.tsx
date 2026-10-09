/** 任务失败时，把「为什么」和「该怎么办」摆出来。
 *
 * # 起因
 *
 * DB 里 17/17 的失败一直都有完整的 failure_json（分类、上游、可重试、建议），
 * job 详情端点也带，**但书籍详情页只吃 document jobs 列表、从不打详情端点**。
 * 于是用户看到的只有「失败」两个字 —— 既不知道是谁的问题，也不知道重试有没有用。
 *
 * 后端那一截已经补上（JobFailureBriefView 进了列表项），这里是呈现。
 *
 * # 完整错误为什么要点开才取
 *
 * 列表每 2 秒轮询一次，不能驮着 traceback（一条就是好几 KB）。所以卡片默认只用
 * 列表里那份简报；点「展开」时才去打一次 job 详情端点拿完整错误。
 */
import { useCallback, useState } from "react";
import { ChevronDown, Copy, FileText, LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";

import { copyText } from "@/platform/utils/clipboard.js";
import type { JobFailureBrief } from "@/platform/contracts/library-payloads.js";
import {
  failureAdvice,
  failureDiagnosticText,
  failureSubtitle,
} from "../../../domain/job-failure-model.js";
import { btn } from "../../panels/ui.js";

/** 卡片上的主动作：翻译任务是「从断点继续」，单独的 OCR 任务是「重新 OCR」。 */
export type JobFailurePrimaryAction = {
  label: string;
  onClick: () => void | Promise<unknown>;
  pending?: boolean;
  pendingLabel?: string;
  /** 按钮下面一句：沿用什么、重跑什么、花不花钱。 */
  hint?: string;
};

export type JobFailureCardProps = {
  failure?: JobFailureBrief | null;
  jobId?: string;
  /** 不给就不画主按钮 —— 没有实现的按钮比没有按钮更糟。 */
  primary?: JobFailurePrimaryAction | null;
  /** 没有主动作时的说明（例如「OCR 没有完成，只能从 OCR 重新开始」）。 */
  notice?: string;
  /** 主动作提交失败的原因，就地显示。 */
  actionError?: string;
  /** 打开任务详情的失败日志。 */
  onOpenLog?: () => void;
  /** 取完整错误（含 traceback）。不给就不画「展开」。 */
  loadDetail?: (jobId: string) => Promise<string>;
};

export function JobFailureCard({
  failure,
  jobId,
  primary = null,
  notice = "",
  actionError = "",
  onOpenLog,
  loadDetail,
}: JobFailureCardProps) {
  const [detail, setDetail] = useState<string>("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [copied, setCopied] = useState(false);

  const advice = failureAdvice(failure);
  const expanded = Boolean(detail || detailError);

  const expand = useCallback(async () => {
    if (!loadDetail || !jobId || loadingDetail || expanded) return;
    setLoadingDetail(true);
    setDetailError("");
    try {
      setDetail((await loadDetail(jobId)) || "（服务端没有返回更多信息）");
    } catch (cause) {
      // 取不到完整错误不该让卡片垮掉 —— 上面那份简报本身就有用。
      setDetailError(cause instanceof Error ? cause.message : "读取完整错误失败");
    } finally {
      setLoadingDetail(false);
    }
  }, [expanded, jobId, loadDetail, loadingDetail]);

  const copy = useCallback(async () => {
    await copyText(failureDiagnosticText({ failure, jobId, detail }));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [detail, failure, jobId]);

  return (
    <section className="book-detail-failure-card" data-job-failure="true" aria-label="失败诊断">
      <header className="book-detail-failure-head">
        <span className="book-detail-failure-icon" aria-hidden="true"><TriangleAlert /></span>
        <div className="book-detail-failure-copy">
          <h4>{advice.title}</h4>
          {failure ? <p className="book-detail-failure-subtitle">{failureSubtitle(failure)}</p> : null}
        </div>
      </header>

      <p className="book-detail-failure-action">{advice.action}</p>

      {/* 后端自己给的根因。它常常就是上游原样抛回来的那句英文，但那句往往比我们
          的分类更具体（「parsing failed, please try again later」）。 */}
      {failure?.root_cause ? (
        <p className="book-detail-failure-cause" data-failure-root-cause="true">{failure.root_cause}</p>
      ) : null}

      <div className="book-detail-failure-actions">
        {primary ? (
          <button
            type="button"
            id="book-detail-retry-failed-btn"
            className={btn(advice.retryLikelyHelps ? "default" : "outline")}
            disabled={Boolean(primary.pending)}
            onClick={() => void primary.onClick()}
          >
            {primary.pending
              ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              : <RotateCcw className="size-3.5" aria-hidden="true" />}
            <span className="ml-1.5">{primary.pending ? primary.pendingLabel || "提交中…" : primary.label}</span>
          </button>
        ) : null}

        <button type="button" className={btn("outline")} onClick={() => void copy()}>
          <Copy className="size-3.5" aria-hidden="true" />
          <span className="ml-1.5">{copied ? "已复制" : "复制诊断信息"}</span>
        </button>

        {onOpenLog ? (
          <button type="button" className={btn("outline")} onClick={onOpenLog}>
            <FileText className="size-3.5" aria-hidden="true" />
            <span className="ml-1.5">查看日志</span>
          </button>
        ) : null}

        {loadDetail && jobId && !expanded ? (
          <button
            type="button"
            className={btn("ghost")}
            disabled={loadingDetail}
            onClick={() => void expand()}
          >
            {loadingDetail
              ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              : <ChevronDown className="size-3.5" aria-hidden="true" />}
            <span className="ml-1.5">{loadingDetail ? "读取中…" : "展开完整错误"}</span>
          </button>
        ) : null}
      </div>

      {primary?.hint ? (
        <p className="book-detail-failure-hint" data-failure-hint="true">{primary.hint}</p>
      ) : notice ? (
        <p className="book-detail-failure-hint" data-failure-notice="true">{notice}</p>
      ) : null}
      {actionError ? (
        <p className="book-detail-failure-detail-error" role="alert" data-failure-action-error="true">{actionError}</p>
      ) : null}

      {detailError ? (
        <p className="book-detail-failure-detail-error" role="alert">{detailError}</p>
      ) : null}
      {detail ? (
        <pre className="book-detail-failure-detail" data-failure-detail="true">{detail}</pre>
      ) : null}
    </section>
  );
}
