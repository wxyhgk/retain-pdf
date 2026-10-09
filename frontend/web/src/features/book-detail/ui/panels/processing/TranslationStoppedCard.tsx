/** 翻译任务失败 / 取消后的那张卡：为什么停了，以及「从断点继续」。
 *
 * 主按钮按后端续跑计划定：
 *   - 能续跑 → 「从渲染继续」「从翻译继续」，下面一句说沿用什么、花不花钱；
 *   - OCR 都没成 → 「从 OCR 重新开始」（就是重新提交整本）；
 *   - 其他不能续跑的情况 → 不给主按钮，说明原因，指到「重新处理」；
 *   - 计划还在读 → 按钮转圈占位，不让人先点了整本重翻。
 * 以前失败卡片的「重试」不分情况一律是「翻译整本」。 */
import { useContext } from "react";
import { HomeStatusDetailContext } from "@/ui/context/home-services-context.js";
import { describeResume, resumeStageLabel } from "../../../domain/job-resume-model.js";
import { translationProcessModel } from "../../../domain/translation-process-model.js";
import type { LibraryCardItem } from "@/features/library/domain.js";
import type { JobFailureBrief } from "@/platform/contracts/library-payloads.js";
import type { BookDetailResumeState } from "../../use-book-detail-resume.js";
import { JobCanceledCard } from "./JobCanceledCard.js";
import { JobFailureCard, type JobFailurePrimaryAction } from "./JobFailureCard.js";

export type TranslationStoppedCardProps = {
  item: LibraryCardItem;
  /** 失败简报；翻译任务自己没有时，由上层用同一次运行的 OCR 失败补上。 */
  failure?: JobFailureBrief | null;
  resume?: BookDetailResumeState | null;
  /** 「从 OCR 重新开始」：重新提交整本。 */
  onRestart?: () => void | Promise<unknown>;
  restarting?: boolean;
  loadDetail?: (jobId: string) => Promise<string>;
};

const RESTART_HINT = "会重新执行 OCR、翻译和排版，费用重新计算。";

function primaryAndNotice({
  resume,
  onRestart,
  restarting,
}: Pick<TranslationStoppedCardProps, "resume" | "onRestart" | "restarting">): {
  primary: JobFailurePrimaryAction | null;
  notice: string;
} {
  if (!resume) return { primary: null, notice: "" };
  if (resume.loading) {
    return {
      primary: { label: "从断点继续", onClick: () => {}, pending: true, pendingLabel: "正在确认能否续跑…" },
      notice: "",
    };
  }
  const described = describeResume(resume.plan);
  if (described.available) {
    return {
      primary: {
        label: described.label,
        hint: described.hint,
        onClick: resume.resume,
        pending: resume.pending,
        pendingLabel: "提交中…",
      },
      notice: "",
    };
  }
  // 计划说 OCR 都没成：没有可沿用的东西，从头来就是正确答案。
  const noOcr = Boolean(resume.plan) && !`${resume.plan?.from_stage || ""}`.trim();
  if (noOcr && onRestart) {
    return {
      primary: {
        label: "从 OCR 重新开始",
        hint: `${described.unavailableReason}${RESTART_HINT}`,
        onClick: onRestart,
        pending: restarting,
        pendingLabel: "提交中…",
      },
      notice: "",
    };
  }
  return {
    primary: null,
    notice: described.unavailableReason || "读不到续跑计划。可以在上面「重新处理」里选择要重做的步骤。",
  };
}

export function TranslationStoppedCard({
  item,
  failure = null,
  resume = null,
  onRestart,
  restarting = false,
  loadDetail,
}: TranslationStoppedCardProps) {
  // 「查看日志」打开任务详情弹窗的失败页。取不到（单独挂载、测试）就不画这个按钮，
  // 不因为缺一个可选入口让整张卡崩掉。
  const statusDetail = useContext(HomeStatusDetailContext);
  const onOpenLog = statusDetail?.controller
    ? () => statusDetail.controller.openStatusDetailDialog("failure")
    : undefined;
  const status = `${item.status || ""}`.trim().toLowerCase();
  const jobId = `${item.job_id || item.active_job_id || ""}`.trim();
  const { primary, notice } = primaryAndNotice({ resume, onRestart, restarting });
  const actionError = resume?.error || "";

  if (status === "canceled" || status === "cancelled") {
    return (
      <JobCanceledCard
        stoppedAt={resumeStageLabel(translationProcessModel(item).currentStage)}
        primary={primary}
        notice={notice}
        actionError={actionError}
        onOpenLog={onOpenLog}
      />
    );
  }
  return (
    <JobFailureCard
      failure={failure}
      jobId={jobId}
      primary={primary}
      notice={notice}
      actionError={actionError}
      onOpenLog={onOpenLog}
      loadDetail={loadDetail}
    />
  );
}
