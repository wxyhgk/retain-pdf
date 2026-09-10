import { normalizeStageRetryActions } from "../presentation/stage-actions.js";

export function buildStatusCardRetryActions(stageActionsPayload = null) {
  return normalizeStageRetryActions(stageActionsPayload);
}
