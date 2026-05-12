import { STAGE_FLOW } from "./job-status-card-presets.js";
import { isSelectableStage } from "./job-status-card-visuals.js";

export function syncStageFlow(host, stageKey = "", selectedStageKey = "") {
  const normalized = `${stageKey || ""}`.trim();
  const selected = `${selectedStageKey || ""}`.trim();
  const activeIndex = STAGE_FLOW.indexOf(normalized);
  host.querySelectorAll(".status-stage-step").forEach((step) => {
    const stepKey = step.dataset.stageKey || "";
    const stepIndex = STAGE_FLOW.indexOf(stepKey);
    const isDone = activeIndex >= 0 && stepIndex >= 0 && stepIndex < activeIndex;
    const isActive = activeIndex >= 0 && stepIndex === activeIndex;
    const isSelected = selected && stepKey === selected;
    const selectable = isSelectableStage(stepKey, normalized);
    step.disabled = !selectable;
    step.setAttribute("aria-selected", isSelected ? "true" : "false");
    step.classList.toggle("is-done", isDone);
    step.classList.toggle("is-active", isActive);
    step.classList.toggle("is-selected", Boolean(isSelected));
    step.classList.toggle("is-disabled", !selectable);
  });
}

export function resolveSelectedStage({
  currentStageKey = "",
  selectedStageKey = "",
  manualStageSelection = false,
} = {}) {
  const current = `${currentStageKey || ""}`.trim();
  const selected = `${selectedStageKey || ""}`.trim();
  if (manualStageSelection && isSelectableStage(selected, current)) {
    return {
      selectedStageKey: selected,
      manualStageSelection: true,
    };
  }
  return {
    selectedStageKey: STAGE_FLOW.includes(current) ? current : "",
    manualStageSelection: false,
  };
}
