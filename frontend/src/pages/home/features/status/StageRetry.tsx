// Nút thử lại giai đoạn (bản thiết kế §2 features/status/, phản chiếu
// renderStageRetryAction/bindStageRetryEvents của job-status-card-retry.js —
// click dispatch APP_EVENTS.retryStage, engine job-runtime nhận; giữ nguyên
// hợp đồng sự kiện theo bản thiết kế §5).

import { useStatusCardIds } from "./status-card-ids-context.js";
import { APP_EVENTS } from "../../composition/external.js";

function dispatchRetryStage(stage) {
  if (globalThis.document?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
    globalThis.document.dispatchEvent(new globalThis.CustomEvent(APP_EVENTS.retryStage, {
      bubbles: true,
      composed: true,
      detail: { stage },
    }));
  }
}

export function StageRetry({ selectedStageKey = "", action = null }) {
  const ids = useStatusCardIds();
  const eligible = ["ocr", "translate", "render"].includes(selectedStageKey) && action;
  if (!eligible) {
    return <div id={ids.stageRetry} className="status-stage-retry is-empty" aria-hidden="true" />;
  }
  const stage = action.stage || (selectedStageKey === "translate" ? "translation" : selectedStageKey);
  return (
    <div id={ids.stageRetry} className="status-stage-retry" aria-hidden="false">
      <button
        type="button"
        className="status-stage-retry-btn"
        data-retry-stage={stage}
        disabled={!action.canRetry}
        title={action.disabledReason || undefined}
        onClick={() => {
          if (action.canRetry) {
            dispatchRetryStage(stage);
          }
        }}
      >
        {action.label || "Thực hiện lại"}
      </button>
    </div>
  );
}
