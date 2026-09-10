function normalizeStageActionKey(stage = "") {
  const value = `${stage || ""}`.trim().toLowerCase();
  if (value === "translation" || value === "translate") {
    return "translate";
  }
  if (value === "ocr" || value === "render") {
    return value;
  }
  return "";
}

export function normalizeStageRetryActions(stageActionsPayload = null) {
  const stages = Array.isArray(stageActionsPayload?.stages) ? stageActionsPayload.stages : [];
  const actions = {};
  stages.forEach((item) => {
    const stageKey = normalizeStageActionKey(item?.stage);
    if (!stageKey) {
      return;
    }
    actions[stageKey] = {
      stage: item.stage === "translation" ? "translation" : stageKey,
      label: item.label || (stageKey === "render" ? "重新渲染" : "重新执行"),
      canRetry: item.can_retry === true,
      disabledReason: item.disabled_reason || item.reason || "",
      danger: item.danger === true,
    };
  });
  return actions;
}
