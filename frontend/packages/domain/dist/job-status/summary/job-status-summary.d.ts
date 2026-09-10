import { firstNonEmpty, looksLikeProviderPercentProgress, numberOrNull } from "./job-status-summary-helpers.js";
import { USER_STAGE_FLOW, USER_STAGE_TOTAL, detailForPayload, normalizedStageText, publicStageKeyOf, stageFlowForKey, stageKeyOf, stageSubtypeOf, successDetailForWorkflow, userStageFor, userStageLabel } from "./job-status-summary-stage.js";
import { summarizeStageProgressText } from "./job-status-summary-progress.js";
export { USER_STAGE_FLOW, USER_STAGE_TOTAL, detailForPayload, firstNonEmpty, looksLikeProviderPercentProgress, normalizedStageText, numberOrNull, publicStageKeyOf, stageFlowForKey, stageKeyOf, stageSubtypeOf, successDetailForWorkflow, summarizeStageProgressText, userStageFor, userStageLabel, };
export declare function summarizeStageLabel(payload: any): string;
export declare function summarizeStageKey(payload: any): string;
export declare function summarizeStageDetail(payload: any): any;
