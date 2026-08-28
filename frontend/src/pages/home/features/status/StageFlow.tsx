// Thanh quy trình giai đoạn (bản thiết kế §2 features/status/, phản chiếu ngữ
// nghĩa syncStageFlow của job-status-card-stage-flow.js; giữ nguyên hợp đồng
// DOM theo từng id/class — smoke test phụ thuộc .status-stage-step
// [data-stage-key][aria-selected]).
//
// Thao tác thử lại không đặt trên pill giai đoạn (dễ chật và lệch bố cục), mà
// StatusCardEmbedded render riêng bên phải dòng tiến trình theo "giai đoạn đang chọn".

import { useStatusCardIds } from "./status-card-ids-context.js";
import {
  isSelectableStatusStage,
  STATUS_STAGE_FLOW,
  STATUS_STAGE_LABELS,
  statusStageIndex,
} from "../../composition/external.js";

/** @deprecated Thử lại đã chuyển khỏi StageFlow; giữ kiểu để import cũ không hỏng. */
export type StageFlowRetryAction = {
  label: string;
  enabled: boolean;
  title?: string;
  onRetry: () => void;
};

type StageFlowProps = {
  currentStageKey?: string;
  selectedStageKey?: string;
  onSelectStage?: (stageKey: string) => void;
  /** Ghi đè id ngữ cảnh; mặc định dùng StatusCardIdsContext. */
  id?: string;
  /** @deprecated Bỏ qua; thử lại được render bởi vùng tiến trình bên ngoài. */
  stageRetries?: Partial<Record<string, StageFlowRetryAction | null | undefined>>;
};

export function StageFlow({
  currentStageKey = "",
  selectedStageKey = "",
  onSelectStage,
  id,
}: StageFlowProps) {
  const ids = useStatusCardIds();
  const flowId = id !== undefined ? id : ids.stageFlow;
  const normalized = `${currentStageKey || ""}`.trim();
  const selected = `${selectedStageKey || ""}`.trim();
  const activeIndex = statusStageIndex(normalized);

  return (
    <div id={flowId || undefined} className="status-stage-flow" role="tablist" aria-label="Quy trình tác vụ">
      {STATUS_STAGE_FLOW.map((stageKey) => {
        const stepIndex = statusStageIndex(stageKey);
        const isDone = activeIndex >= 0 && stepIndex >= 0 && stepIndex < activeIndex;
        const isActive = activeIndex >= 0 && stepIndex === activeIndex;
        const isSelected = Boolean(selected) && stageKey === selected;
        const selectable = isSelectableStatusStage(stageKey, normalized);
        const classNames = ["status-stage-step"];
        if (isDone) classNames.push("is-done");
        if (isActive) classNames.push("is-active");
        if (isSelected) classNames.push("is-selected");
        if (!selectable) classNames.push("is-disabled");
        return (
          <button
            key={stageKey}
            type="button"
            className={classNames.join(" ")}
            role="tab"
            data-stage-key={stageKey}
            disabled={!selectable}
            aria-selected={isSelected ? "true" : "false"}
            onClick={() => {
              if (selectable) {
                onSelectStage?.(stageKey);
              }
            }}
          >
            <span className="status-stage-step-name">{STATUS_STAGE_LABELS[stageKey]}</span>
          </button>
        );
      })}
    </div>
  );
}
