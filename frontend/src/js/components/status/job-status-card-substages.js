import { TRANSLATION_SUBSTAGES } from "./job-status-card-presets.js";

export function translationSubstageKeyForSnapshot(snapshot = null) {
  const text = `${snapshot?.label || ""} ${snapshot?.value || ""} ${snapshot?.progressText || ""}`.toLowerCase();
  if (text.includes("跨栏") || text.includes("跨页")) {
    return "continuation_review";
  }
  if (text.includes("页面策略") || text.includes("块分类")) {
    return "page_policies";
  }
  if (text.includes("乱码")) {
    return "garbled";
  }
  if (text.includes("翻译批次") || (text.includes("第 ") && text.includes(" 批"))) {
    return "translation_batches";
  }
  if (snapshot?.stageKey === "translate") {
    return "translation_batches";
  }
  return "";
}

export function syncTranslationSubstageStates(container, selectedStageKey, selectedIsCurrent, snapshot) {
  if (!container) {
    return;
  }
  const activeKey = selectedIsCurrent && selectedStageKey === "translate"
    ? translationSubstageKeyForSnapshot(snapshot)
    : "";
  container.classList.toggle("hidden", selectedStageKey !== "translate");
  container.querySelectorAll(".status-substage-step").forEach((step) => {
    const key = step.dataset.substageKey || "";
    const stepIndex = TRANSLATION_SUBSTAGES.findIndex((item) => item.key === key);
    const activeIndex = TRANSLATION_SUBSTAGES.findIndex((item) => item.key === activeKey);
    step.classList.toggle("is-active", key === activeKey);
    step.classList.toggle("is-done", activeIndex >= 0 && stepIndex >= 0 && stepIndex < activeIndex);
  });
}
