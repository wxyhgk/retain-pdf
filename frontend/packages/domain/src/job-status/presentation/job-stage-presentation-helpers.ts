import {
  summarizeStageKey,
  stageSubtypeOf,
} from "../summary/job-status-summary.js";
import { visualStageKeyForEventPayload } from "../contract/job-stage-progress-record-normalizer.js";

export function translationSubstageKeyFromTextPayload(payload: any = {}) {
  if (summarizeStageKey(payload) !== "translate") {
    return "";
  }
  return stageSubtypeOf(payload);
}

export function substageMatchesStage(stageKey = "", substageKey = "") {
  const substage = `${substageKey || ""}`.trim();
  if (!substage) {
    return true;
  }
  if (stageKey === "translate") {
    return !substage.startsWith("render_") && !substage.startsWith("ocr_");
  }
  if (stageKey === "render") {
    return substage.startsWith("render_");
  }
  if (stageKey === "ocr") {
    return substage.startsWith("ocr_") || substage === "normalizing";
  }
  return true;
}

export function visualStageKeyForPresentation(job: any = {}, stageKey = "") {
  const substage = `${job?.substage || job?.payload?.substage || ""}`.trim().toLowerCase();
  if (stageKey === "ocr" && substage) {
    return visualStageKeyForEventPayload(job, stageKey);
  }
  return stageKey;
}
