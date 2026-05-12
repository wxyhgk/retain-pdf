import { STAGE_ANIMATIONS, STAGE_FLOW } from "./job-status-card-presets.js";

export function resolveVisualStageKeyForSnapshot(snapshot = null, selectedStageKey = "") {
  const stageKey = `${snapshot?.stageKey || ""}`.trim();
  const visualStageKey = `${snapshot?.visualStageKey || ""}`.trim();
  const selected = `${selectedStageKey || ""}`.trim();
  if (!selected || selected === stageKey) {
    return visualStageKey || stageKey;
  }
  if (stageKey === "ocr" && selected !== "ocr") {
    return visualStageKey || "ocr";
  }
  return selected;
}

export function resolveAnimationPathForStage(stageKey = "") {
  return STAGE_ANIMATIONS[`${stageKey || ""}`.trim()] || "";
}

export function isSelectableStage(stageKey, currentStageKey, currentFlow = STAGE_FLOW) {
  const selectedIndex = currentFlow.indexOf(stageKey);
  const currentIndex = currentFlow.indexOf(currentStageKey);
  if (selectedIndex < 0 || currentIndex < 0) {
    return false;
  }
  return selectedIndex <= currentIndex;
}
