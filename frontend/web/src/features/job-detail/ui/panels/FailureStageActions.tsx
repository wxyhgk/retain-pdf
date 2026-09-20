// 失败恢复动作列表：后端返回几个阶段就渲染几个按钮。
//
// 这里没有、也不该有任何 `if (category === "xxx")`——新增一种失败只改后端的
// 恢复目录表，本组件连阶段名都不认识，文案（label / noteText）全部由后端和
// failure-recovery-stages 的纯函数给出。

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/ui/components/confirm-dialog.js";
import type { FailureRecoveryStage } from "../../domain/dialog/failure-recovery.js";
import { STATUS_DETAIL_DIALOG_IDS } from "../../domain/status-detail-dom-ids.js";

type FailureStageActionsProps = {
  hint: string;
  stages: FailureRecoveryStage[];
  retryStage?: (
    stage: string,
    options?: { acceptDuplicateRisk?: boolean },
  ) => Promise<unknown> | unknown;
};

export function FailureStageActions({ hint, stages, retryStage }: FailureStageActionsProps) {
  const ids = STATUS_DETAIL_DIALOG_IDS.failure;
  const [pendingStage, setPendingStage] = useState("");
  const [riskStage, setRiskStage] = useState("");
  const [feedback, setFeedback] = useState("");

  if (!stages.length) return null;

  async function runStage(stage: string, options: { acceptDuplicateRisk?: boolean } = {}) {
    const entry = stages.find((item) => item.stage === stage);
    // 可能重复执行的阶段先弹确认，和队列繁忙卡片同一套规矩。
    if (entry?.action.requiresDuplicateRisk && !options.acceptDuplicateRisk) {
      setRiskStage(stage);
      return;
    }
    setPendingStage(stage);
    setFeedback("正在创建恢复任务…");
    try {
      await retryStage?.(stage, options);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error));
    } finally {
      setPendingStage("");
    }
  }

  return (
    <div id={ids.recoveryStages} className="status-detail-failure-stages">
      <p id={ids.recoveryHint} className="status-panel-note">{hint}</p>
      {stages.map((item) => {
        const clickable = item.action.enabled || item.action.requiresDuplicateRisk;
        const disabled = !clickable || Boolean(pendingStage);
        return (
          <div
            key={item.stage}
            className="failure-action-row status-detail-recovery-actions"
            data-stage={item.stage}
            data-recommended={item.recommended ? "true" : undefined}
          >
            <button
              id={`failure-stage-retry-${item.stage}`}
              type="button"
              className="button-link secondary"
              disabled={disabled}
              title={disabled ? item.noteText : undefined}
              onClick={() => void runStage(item.stage)}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {pendingStage === item.stage ? "正在重试…" : item.label}
            </button>
            <span id={`failure-stage-note-${item.stage}`} className="status-panel-note">
              {item.noteText}
            </span>
          </div>
        );
      })}
      <span id={ids.recoveryFeedback} className="status-panel-note" role="status">{feedback}</span>
      <ConfirmDialog
        id={ids.recoveryRiskConfirm}
        open={Boolean(riskStage)}
        onOpenChange={(open: boolean) => { if (!open) setRiskStage(""); }}
        pending={Boolean(pendingStage)}
        title="确认重新执行该阶段"
        description="上游可能已经收到上一次请求。继续会重新执行该阶段，可能造成重复处理或计费。"
        confirmLabel="确认重试"
        tone="danger"
        onConfirm={() => {
          const stage = riskStage;
          setRiskStage("");
          void runStage(stage, { acceptDuplicateRisk: true });
        }}
      />
    </div>
  );
}
