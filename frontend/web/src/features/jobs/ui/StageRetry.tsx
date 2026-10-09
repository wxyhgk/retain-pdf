// 阶段重试按钮(蓝图 §2 features/status/;镜像 job-status-card-retry.js 的
// renderStageRetryAction/bindStageRetryEvents——点击 dispatch
// APP_EVENTS.retryStage,job-runtime 引擎消费,事件契约原样保留,蓝图 §5)。

import { useStatusCardIds } from "./status-card-ids-context.js";
import {
  APP_EVENTS,
} from "@/platform/contracts/app-contract.js";
import type { StatusCardStageRetryAction } from "../domain/status-card-store.js";

function dispatchRetryStage(stage: string) {
  if (globalThis.document?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
    globalThis.document.dispatchEvent(new globalThis.CustomEvent(APP_EVENTS.retryStage, {
      bubbles: true,
      composed: true,
      detail: { stage },
    }));
  }
}

export function StageRetry({
  selectedStageKey = "",
  action = null,
}: {
  selectedStageKey?: string;
  action?: StatusCardStageRetryAction | null;
}) {
  const ids = useStatusCardIds();
  const eligible = ["ocr", "translate", "render"].includes(selectedStageKey) && action;
  if (!eligible) {
    return <div id={ids.stageRetry} className="status-stage-retry is-empty" aria-hidden="true" />;
  }
  const stage = action.stage || (selectedStageKey === "translate" ? "translation" : selectedStageKey);
  // 口径说明：此处 disabled = !canRetry 是按钮的直显语义；status-card/retry.ts:78 的
  // `canRetry || failed || succeeded` 决定的是“是否返回按钮配置”（不满足则返回 null
  // 隐藏按钮），两者分层不冲突——能走到这里说明已满足展示条件，是否可点只看 canRetry。
  // 禁用原因必须可达：后端 disabledReason 为空时给默认文案。
  const disabled = !action.canRetry;
  const disabledReasonText = `${action.disabledReason || ""}`.trim();
  const title = disabled
    ? (disabledReasonText || "当前阶段暂不可重试，请稍后刷新重试。")
    : (action.disabledReason || undefined);
  return (
    <div id={ids.stageRetry} className="status-stage-retry" aria-hidden="false">
      <button
        type="button"
        className="status-stage-retry-btn"
        data-retry-stage={stage}
        disabled={disabled}
        title={title}
        onClick={() => {
          if (action.canRetry) {
            dispatchRetryStage(stage);
          }
        }}
      >
        {action.label || "重新执行"}
      </button>
    </div>
  );
}
