import {
  firstNonEmpty,
  looksLikeProviderPercentProgress,
  numberOrNull,
  progressFromText,
} from "./job-status-summary-helpers.js";
import { stageKeyOf, stageSubtypeOf, userStageFor } from "./job-status-summary-stage.js";

export function summarizeStageProgressText(payload) {
  const rawCurrent = numberOrNull(payload.progress_current ?? payload.progress?.current);
  const rawTotal = numberOrNull(payload.progress_total ?? payload.progress?.total);
  const textProgress = progressFromText(payload);
  const current = rawCurrent === 0 && Number.isFinite(textProgress.current) && textProgress.current > 0
    ? textProgress.current
    : rawCurrent;
  const total = rawTotal === null ? textProgress.total : rawTotal;
  if (current === null || total === null || total <= 0) {
    return "";
  }
  const stageKey = stageKeyOf(payload);
  const subtype = stageSubtypeOf(payload);
  const stage = userStageFor(payload);
  if (subtype === "continuation_review" || subtype === "page_policies") {
    return `第 ${current}/${total} 页`;
  }
  if (subtype === "domain_inference" || subtype === "translation_prepare") {
    return `进度 ${current}/${total}`;
  }
  if (stage.key === "translate") {
    return `第 ${current}/${total} 批`;
  }
  if (stage.key === "ocr") {
    if (looksLikeProviderPercentProgress(current, total)) {
      return current > 0 ? `OCR ${current}%` : "OCR 处理中";
    }
    return `第 ${current}/${total} 页`;
  }
  if (stage.key === "render") {
    return `第 ${current}/${total} 页`;
  }
  return `进度 ${current}/${total}`;
}
