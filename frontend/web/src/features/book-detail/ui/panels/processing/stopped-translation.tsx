/** 任务停下（失败 / 取消）后状态行上的主按钮：从断点继续、从 OCR 重新开始、重新 OCR。
 *
 * 翻译任务的主按钮按后端续跑计划定：
 *   - 能续跑 → 「从渲染继续」「从翻译继续」，悬停和「错误」页说沿用什么、花不花钱；
 *   - OCR 都没成 → 「从 OCR 重新开始」（就是重新提交整本）；
 *   - 其他不能续跑的情况 → 不给主按钮，「错误」页说明原因，重做的动作在流水线各站上；
 *   - 计划还在读 → 按钮转圈占位，不让人先点了整本重翻。
 * 以前失败卡片的「重试」不分情况一律是「翻译整本」。 */
import { Button } from "@retainpdf/ui";
import { LoaderCircle, Play, RotateCcw } from "lucide-react";

import { describeResume } from "../../../domain/job-resume-model.js";
import type { BookDetailResumeState } from "../../use-book-detail-resume.js";

/** 主动作：翻译任务是「从断点继续」，单独的 OCR 任务是「重新 OCR」。 */
export type JobFailurePrimaryAction = {
  label: string;
  onClick: () => void | Promise<unknown>;
  pending?: boolean;
  pendingLabel?: string;
  /** 沿用什么、重跑什么、花不花钱。 */
  hint?: string;
};

const RESTART_HINT = "会重新执行 OCR、翻译和排版，费用重新计算。";

export function stoppedTranslationAction({
  resume,
  onRestart,
  restarting = false,
}: {
  resume?: BookDetailResumeState | null;
  onRestart?: () => void | Promise<unknown>;
  restarting?: boolean;
}): { primary: JobFailurePrimaryAction | null; notice: string } {
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
    notice: described.unavailableReason || "读不到续跑计划。可以点流水线各站上的按钮选择要重做的步骤。",
  };
}

/** 状态行上的主按钮。取消后的「继续」用播放图标，失败后的重试用回转图标。 */
export function PrimaryActionButton({
  id,
  action,
  kind = "retry",
  variant = "primary",
}: {
  id: string;
  action: JobFailurePrimaryAction;
  kind?: "retry" | "resume";
  variant?: "primary" | "secondary";
}) {
  const Icon = kind === "resume" ? Play : RotateCcw;
  return (
    <Button
      id={id}
      variant={variant}
      disabled={Boolean(action.pending)}
      title={action.hint || undefined}
      onClick={() => void action.onClick()}
    >
      {action.pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Icon aria-hidden="true" />}
      {action.pending ? action.pendingLabel || "提交中…" : action.label}
    </Button>
  );
}
