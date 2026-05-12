import {
  firstNonEmpty,
  looksLikeProviderPercentProgress,
  numberOrNull,
  progressFromText,
} from "./job-status-summary-helpers.js";
import {
  DETAIL_TEXT_MAP,
  USER_STAGE_FLOW,
  USER_STAGE_TOTAL,
  detailForPayload,
  normalizedStageText,
  rawStageOf,
  stageFlowForKey,
  stageKeyOf,
  stageSubtypeOf,
  userStageFlowIndex,
  userStageFor,
  userStageLabel,
} from "./job-status-summary-stage.js";
import { summarizeStageProgressText } from "./job-status-summary-progress.js";

export {
  DETAIL_TEXT_MAP,
  USER_STAGE_FLOW,
  USER_STAGE_TOTAL,
  detailForPayload,
  firstNonEmpty,
  looksLikeProviderPercentProgress,
  normalizedStageText,
  numberOrNull,
  progressFromText,
  rawStageOf,
  stageFlowForKey,
  stageKeyOf,
  stageSubtypeOf,
  summarizeStageProgressText,
  userStageFlowIndex,
  userStageFor,
  userStageLabel,
};

export function summarizeStageLabel(payload) {
  return userStageLabel(payload);
}

export function summarizeStageKey(payload) {
  return userStageFor(payload).key;
}

export function summarizeStageDetail(payload) {
  const failureDetail = firstNonEmpty(payload.failure?.summary);
  if (failureDetail) {
    return failureDetail;
  }
  const stage = userStageFor(payload);
  return stage.detail || stage.label || "-";
}
