import { buildStatusCardPrimaryActions } from "./status-card/status-card-actions-view-model.js";
import { buildStatusCardErrorState } from "./status-card/status-card-error-view-model.js";
import { resolveSelectedStageContext } from "./presentation/selected-stage-view-model.js";
export function buildSelectedStageDisplay({ snapshot = null, selectedStageKey = "", } = {}) {
    const context = resolveSelectedStageContext({
        snapshot,
        selectedStageKey,
    });
    const detailText = `${snapshot?.detail || ""}`.trim();
    const visualStageKey = context.selectedProgress?.visualStageKey
        || context.selectedHistoricalProgress?.visualStageKey
        || "";
    return {
        ...context,
        visualStageKey,
        detailText,
        showDetail: Boolean(detailText),
        errorState: buildStatusCardErrorState(snapshot),
        primaryActions: buildStatusCardPrimaryActions({
            selectedStageKey: context.selected,
            snapshot,
        }),
        retryAction: snapshot?.stageRetryActions?.[context.selected],
    };
}
