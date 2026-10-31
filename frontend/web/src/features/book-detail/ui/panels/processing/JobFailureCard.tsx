/** 任务失败时「错误」页里的一块：为什么失败、重试有没有用、后端给的根因，点开才取完整错误。
 *
 * # 起因
 *
 * DB 里 17/17 的失败一直都有完整的 failure_json（分类、上游、可重试、建议），
 * job 详情端点也带，**但书籍详情页只吃 document jobs 列表、从不打详情端点**。
 * 于是用户看到的只有「失败」两个字 —— 既不知道是谁的问题，也不知道重试有没有用。
 * 后端那一截已经补上（JobFailureBriefView 进了列表项），这里是呈现。
 *
 * # 主按钮不在这里
 *
 * 「从断点继续」「重新 OCR」放在「进度」页的状态行（PrimaryActionButton），和取消、详情在一处。
 * 这里只说它会沿用什么、花不花钱（hint），或者为什么没有主按钮（notice）。同一页两段都失败时，
 * 不是主角的那段把自己的按钮放进 action。
 *
 * # 完整错误为什么要点开才取
 *
 * 列表每 2 秒轮询一次，不能驮着 traceback（一条就是好几 KB）。所以默认只用
 * 列表里那份简报；点「完整错误」时才去打一次 job 详情端点拿完整错误。
 */
import { Button, IconButton } from "@retainpdf/ui";
import { useCallback, useState, type ReactNode } from "react";
import { Ban, Check, ChevronDown, Coins, Copy, LoaderCircle, RotateCcw, Server, TriangleAlert } from "lucide-react";

import { copyText } from "@/platform/utils/clipboard.js";
import type { JobFailureBrief } from "@/platform/contracts/library-payloads.js";
import {
  failureAdvice,
  failureDiagnosticText,
  failureSubtitle,
} from "../../../domain/job-failure-model.js";

export type JobFailureCardProps = {
  failure?: JobFailureBrief | null;
  jobId?: string;
  /** 主动作会沿用什么、花不花钱（「沿用已有译文，只重新排版」）。 */
  hint?: string;
  /** 没有主动作时的说明（例如「OCR 没有完成，只能从 OCR 重新开始」）。 */
  notice?: string;
  /** 主动作提交失败的原因，就地显示。 */
  actionError?: string;
  /** 取完整错误（含 traceback）。不给就不画「完整错误」。 */
  loadDetail?: (jobId: string) => Promise<string>;
  /** 这一段自己的按钮（两段都失败时，不在状态行上的那段）。 */
  action?: ReactNode;
};

export function JobFailureCard({
  failure,
  jobId,
  hint = "",
  notice = "",
  actionError = "",
  loadDetail,
  action = null,
}: JobFailureCardProps) {
  const [detail, setDetail] = useState<string>("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [copied, setCopied] = useState(false);

  const advice = failureAdvice(failure);
  const subtitle = failureSubtitle(failure);
  const expanded = Boolean(detail || detailError);

  const expand = useCallback(async () => {
    if (!loadDetail || !jobId || loadingDetail || expanded) return;
    setLoadingDetail(true);
    setDetailError("");
    try {
      setDetail((await loadDetail(jobId)) || "（服务端没有返回更多信息）");
    } catch (cause) {
      // 取不到完整错误不该让这一块垮掉 —— 上面那份简报本身就有用。
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
        <TriangleAlert className="book-detail-failure-icon" aria-hidden="true" />
        <h4>{advice.title}</h4>
        <span className="book-detail-failure-tools">
          {action}
          <IconButton size="sm" label={copied ? "已复制" : "复制诊断信息"} onClick={() => void copy()}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </IconButton>
        </span>
      </header>

      <p className="book-detail-failure-chips">
        {subtitle ? (
          <span className="book-detail-failure-chip" data-failure-chip="source"><Server aria-hidden="true" />{subtitle}</span>
        ) : null}
        <span className="book-detail-failure-chip" data-failure-chip="retry" data-retry-helps={advice.retryLikelyHelps ? "true" : "false"}>
          {advice.retryLikelyHelps ? <RotateCcw aria-hidden="true" /> : <Ban aria-hidden="true" />}
          {advice.retryLikelyHelps ? "重试多半有用" : "重试解决不了"}
        </span>
      </p>

      {/* 重试有用时，「重试多半有用」加上状态行的按钮已经说够了；没用时才需要说该做什么（换 Key、换文件）。 */}
      {advice.retryLikelyHelps ? null : <p className="book-detail-failure-action">{advice.action}</p>}

      {/* 后端自己给的根因。它常常就是上游原样抛回来的那句英文，但那句往往比我们
          的分类更具体（「parsing failed, please try again later」）。 */}
      {failure?.root_cause ? (
        <p className="book-detail-failure-cause" data-failure-root-cause="true">{failure.root_cause}</p>
      ) : null}

      {hint ? (
        <p className="book-detail-failure-hint" data-failure-hint="true"><Coins aria-hidden="true" />{hint}</p>
      ) : notice ? (
        <p className="book-detail-failure-hint" data-failure-notice="true">{notice}</p>
      ) : null}
      {actionError ? (
        <p className="book-detail-failure-detail-error" role="alert" data-failure-action-error="true">{actionError}</p>
      ) : null}

      {loadDetail && jobId && !expanded ? (
        <Button variant="ghost" size="sm" className="book-detail-failure-expand" disabled={loadingDetail} onClick={() => void expand()}>
          {loadingDetail ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          {loadingDetail ? "读取中…" : "完整错误"}
        </Button>
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
