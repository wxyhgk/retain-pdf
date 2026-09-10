import { firstNonEmpty, looksLikeProviderPercentProgress, numberOrNull, } from "./job-status-summary-helpers.js";
import { USER_STAGE_FLOW, USER_STAGE_TOTAL, detailForPayload, normalizedStageText, publicStageKeyOf, stageFlowForKey, stageKeyOf, stageSubtypeOf, successDetailForWorkflow, userStageFor, userStageLabel, } from "./job-status-summary-stage.js";
import { summarizeStageProgressText } from "./job-status-summary-progress.js";
export { USER_STAGE_FLOW, USER_STAGE_TOTAL, detailForPayload, firstNonEmpty, looksLikeProviderPercentProgress, normalizedStageText, numberOrNull, publicStageKeyOf, stageFlowForKey, stageKeyOf, stageSubtypeOf, successDetailForWorkflow, summarizeStageProgressText, userStageFor, userStageLabel, };
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
