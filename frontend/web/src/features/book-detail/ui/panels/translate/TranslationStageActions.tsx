import { useState } from "react";
import { Languages, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { ConfirmDialog } from "@/ui/components/confirm-dialog.js";
import type {
  JobRetryStage,
  JobStageRetryActionView,
} from "@/platform/api/index.js";
import { btn } from "../ui.jsx";

function labelOf(action: JobStageRetryActionView) {
  if (action.stage === "translation") return "重新翻译";
  if (action.stage === "render") return "重新渲染";
  if (action.stage === "refine") return "精修译文";
  return action.label;
}

// 需要先确认再执行的动作：重新翻译（后端标 danger）和精修（会调模型、产生费用）。
function needsConfirm(action: JobStageRetryActionView) {
  return Boolean(action.danger) || action.stage === "refine";
}

const CONFIRM_COPY: Record<string, { title: string; description: string; confirmLabel: string }> = {
  translation: {
    title: "确认重新翻译",
    description: "将先尝试断点恢复：服务端按恢复计划自动续跑（渲染阶段原地同任务，其余新建任务）。仍需显式重跑时，确认后将复用现有 OCR，重新执行翻译与渲染，可能重复调用翻译接口并产生费用。",
    confirmLabel: "接受风险并重新翻译",
  },
  refine: {
    title: "精修译文",
    description: "在现有译文上让模型挑一遍错（漏译、错译、数字和术语），只改有问题的片段，改完自动重新渲染一次。不会重新翻译整本；每处修改都会留下记录，改不好的会保留原译，之后也能退回。会调用模型、产生少量费用，耗时视页数而定。",
    confirmLabel: "开始精修",
  },
};

function StageIcon({ stage }: { stage: JobRetryStage }) {
  if (stage === "translation") return <Languages className="size-4" aria-hidden="true" />;
  if (stage === "refine") return <Sparkles className="size-4" aria-hidden="true" />;
  return <RefreshCw className="size-4" aria-hidden="true" />;
}

const LOADING_ACTIONS: JobStageRetryActionView[] = [
  {
    stage: "translation",
    label: "重新翻译",
    can_retry: false,
    disabled_reason: "正在确认可用性",
  },
  {
    stage: "render",
    label: "重新渲染",
    can_retry: false,
    disabled_reason: "正在确认可用性",
  },
];

export function TranslationStageActions({
  actions = [],
  loading = false,
  pendingStage = "",
  error = "",
  onRetry,
}: {
  actions?: JobStageRetryActionView[];
  loading?: boolean;
  pendingStage?: JobRetryStage | "";
  error?: string;
  onRetry: (
    stage: JobRetryStage,
    options?: { acceptDuplicateRisk?: boolean },
  ) => Promise<unknown>;
}) {
  const [confirmAction, setConfirmAction] = useState<JobStageRetryActionView | null>(null);
  // 父级 hook 已把错误写入 error prop；本地兜底覆盖 onRetry 直接抛错
  // 但父级未落 error 的场景（如 mock/装配差异），保证错误仍落到 UI。
  const [localError, setLocalError] = useState("");
  const checking = loading && !actions.length;
  const visibleActions = checking ? LOADING_ACTIONS : actions;
  const shownError = error || localError;
  const confirmCopy = CONFIRM_COPY[confirmAction?.stage === "refine" ? "refine" : "translation"];
  if (!visibleActions.length && !shownError) return null;

  function describeRetryError(cause: unknown): string {
    const message = `${(cause as Error)?.message || cause || ""}`.trim();
    return message || "重新处理失败，请稍后重试。";
  }

  async function runRetry(
    stage: JobRetryStage,
    options?: { acceptDuplicateRisk?: boolean },
  ) {
    setLocalError("");
    try {
      await onRetry(stage, options);
    } catch (cause) {
      // 错误落到 UI 文案，按钮保持可操作（disabled 仅由 checking/pending/can_retry 决定）。
      setLocalError(describeRetryError(cause));
    }
  }

  // 一键断点恢复：按钮先调 POST /resume（服务端按 resume-plan 自动续跑，
  // render 原地同任务、其余新建）；仅二次确认接受重复风险后，才用
  // retry-stage(显式 stage)兜底。id/disabled/ConfirmDialog 语义保持不变。
  async function confirmRisk() {
    if (!confirmAction) return;
    try {
      // 精修的确认只是「知道要花钱」，不是接受重复请求风险。
      await onRetry(
        confirmAction.stage,
        confirmAction.stage === "refine" ? undefined : { acceptDuplicateRisk: true },
      );
      setLocalError("");
      setConfirmAction(null);
    } catch (cause) {
      // 失败给文案且不吞错：确认框保持打开，允许用户取消或重试。
      setLocalError(describeRetryError(cause));
    }
  }

  return (
    <div
      className="book-detail-stage-actions"
      data-translation-stage-actions="true"
      aria-busy={checking || undefined}
    >
      <div className="book-detail-stage-actions-buttons">
        {visibleActions.map((action) => {
          const pending = pendingStage === action.stage;
          const disabled = checking || Boolean(pendingStage) || !action.can_retry;
          const reason = `${action.disabled_reason || action.reason || ""}`.trim();
          return (
            <button
              key={action.stage}
              id={`book-detail-retry-${action.stage}-btn`}
              type="button"
              className={btn("outline")}
              disabled={disabled}
              title={!action.can_retry && reason ? reason : undefined}
              onClick={() => {
                if (needsConfirm(action)) setConfirmAction(action);
                else void runRetry(action.stage);
              }}
            >
              {checking
                ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                : <StageIcon stage={action.stage} />}
              <span className="ml-1.5">{pending ? "提交中…" : labelOf(action)}</span>
            </button>
          );
        })}
      </div>
      {shownError ? <p className="book-detail-stage-actions-error rounded-md border border-foreground/20 bg-muted/40 px-3 py-2 text-xs text-foreground" role="alert">{shownError}</p> : null}
      <ConfirmDialog
        id="book-detail-translation-risk-confirm"
        open={Boolean(confirmAction)}
        onOpenChange={(next) => {
          if (!next) setConfirmAction(null);
        }}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.confirmLabel}
        tone="default"
        pending={Boolean(confirmAction) && pendingStage === confirmAction?.stage}
        onConfirm={confirmRisk}
      />
    </div>
  );
}
