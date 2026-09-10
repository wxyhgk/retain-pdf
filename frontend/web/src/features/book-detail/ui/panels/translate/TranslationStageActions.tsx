import { useState } from "react";
import { Languages, LoaderCircle, RefreshCw } from "lucide-react";
import { ConfirmDialog } from "@/ui/components/confirm-dialog.js";
import type {
  JobRetryStage,
  JobStageRetryActionView,
} from "@/platform/api/index.js";
import { btn } from "../ui.jsx";

function labelOf(action: JobStageRetryActionView) {
  if (action.stage === "translation") return "重新翻译";
  if (action.stage === "render") return "重新渲染";
  return action.label;
}

function StageIcon({ stage }: { stage: JobRetryStage }) {
  return stage === "translation"
    ? <Languages className="size-4" aria-hidden="true" />
    : <RefreshCw className="size-4" aria-hidden="true" />;
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
  const checking = loading && !actions.length;
  const visibleActions = checking ? LOADING_ACTIONS : actions;
  if (!visibleActions.length && !error) return null;

  // 一键断点恢复：按钮先调 POST /resume（服务端按 resume-plan 自动续跑，
  // render 原地同任务、其余新建）；仅二次确认接受重复风险后，才用
  // retry-stage(显式 stage)兜底。id/disabled/ConfirmDialog 语义保持不变。
  async function confirmRisk() {
    if (!confirmAction) return;
    try {
      await onRetry(confirmAction.stage, { acceptDuplicateRisk: true });
      setConfirmAction(null);
    } catch {
      // 错误由所属处理卡展示；确认框保持打开，允许用户取消。
    }
  }

  return (
    <div
      className="book-detail-stage-actions space-y-2"
      data-translation-stage-actions="true"
      aria-busy={checking || undefined}
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
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
                if (action.danger) setConfirmAction(action);
                else void onRetry(action.stage).catch(() => {});
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
      {error ? <p className="rounded-md border border-foreground/20 bg-muted/40 px-3 py-2 text-xs text-foreground" role="alert">{error}</p> : null}
      <ConfirmDialog
        id="book-detail-translation-risk-confirm"
        open={Boolean(confirmAction)}
        onOpenChange={(next) => {
          if (!next) setConfirmAction(null);
        }}
        title="确认重新翻译"
        description="将先尝试断点恢复：服务端按恢复计划自动续跑（渲染阶段原地同任务，其余新建任务）。仍需显式重跑时，确认后将复用现有 OCR，重新执行翻译与渲染，可能重复调用翻译接口并产生费用。"
        confirmLabel="接受风险并重新翻译"
        tone="default"
        pending={pendingStage === "translation"}
        onConfirm={confirmRisk}
      />
    </div>
  );
}
