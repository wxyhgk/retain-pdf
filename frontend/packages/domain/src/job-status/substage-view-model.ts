import {
  substageCardLabel,
  substagesForStage,
} from "./contract/job-stage-substage-contract.js";

export function translationSubstageKeyForSnapshot(snapshot = null) {
  const explicitSubstage = `${snapshot?.substageKey || ""}`.trim();
  if (explicitSubstage) {
    return explicitSubstage;
  }
  if (snapshot?.stageKey === "translate") {
    return "translation_batches";
  }
  return "";
}

export function substageKeyForSnapshot(snapshot = null) {
  const explicitSubstage = `${snapshot?.substageKey || ""}`.trim();
  if (explicitSubstage) {
    return explicitSubstage;
  }
  if (snapshot?.stageKey === "translate") {
    return translationSubstageKeyForSnapshot(snapshot);
  }
  return "";
}

export function collectVisibleSubstages(stageKey, activeKey, selectedProgress = null) {
  const known = substagesForStage(stageKey);
  const knownKeys = new Set(known.map((item) => item.key));
  const bySubstage = selectedProgress?.bySubstage || {};
  const visibleKeys = Object.keys(bySubstage)
    .filter((key) => knownKeys.has(key));
  if (activeKey && knownKeys.has(activeKey) && !visibleKeys.includes(activeKey)) {
    visibleKeys.push(activeKey);
  }
  const visibleIndexes = visibleKeys
    .map((key) => known.findIndex((item) => item.key === key))
    .filter((index) => index >= 0);
  const activeIndex = activeKey ? known.findIndex((item) => item.key === activeKey) : -1;
  if (activeIndex >= 0) {
    const reachedIndexes = visibleIndexes.filter((index) => index <= activeIndex);
    const firstVisibleIndex = reachedIndexes.length > 0 && reachedIndexes.some((index) => index < activeIndex)
      ? Math.min(...reachedIndexes)
      : 0;
    for (let index = firstVisibleIndex; index <= activeIndex; index += 1) {
      const key = known[index]?.key;
      if (key && !visibleKeys.includes(key)) {
        visibleKeys.push(key);
      }
    }
  }
  return known.filter((item) => visibleKeys.includes(item.key));
}

function labelForSubstage(substageKey) {
  return substageCardLabel(substageKey) || substageKey;
}

export function buildSubstageViewModel({
  selectedStageKey = "",
  selectedIsCurrent = false,
  snapshot = null,
  selectedProgress = null,
}: any = {}) {
  const activeKey = selectedProgress?.substageKey || (selectedIsCurrent ? substageKeyForSnapshot(snapshot) : "");
  const substages = collectVisibleSubstages(selectedStageKey, activeKey, selectedProgress);
  const activeIndex = substages.findIndex((item) => item.key === activeKey);
  return {
    activeKey,
    count: substages.length,
    hidden: substages.length === 0,
    cssCount: Math.min(Math.max(substages.length, 1), 5),
    items: substages.map((item, index) => ({
      key: item.key,
      label: labelForSubstage(item.key),
      active: item.key === activeKey,
      done: activeIndex >= 0 && index < activeIndex,
    })),
  };
}
