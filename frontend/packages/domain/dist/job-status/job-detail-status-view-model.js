// frontend/packages/domain/src/job-status/job-detail-status-view-model.ts — pure job-detail status view-models
// Extracted verbatim from frontend/web/src/js/job-detail/status-view-model.ts.
import { resolveDisplayedStagePresentation } from "./presentation/job-stage-presentation.js";
import { normalizedStageEventRecord } from "./job-stage-event-record.js";
import { adaptJobEventStageSnapshot } from "./job-stage-contract-adapter.js";
import { summarizeRuntimeField } from "../job/formatters.js";
function firstNonEmptyText(...values) {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return "";
}
function numberOrNull(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}
function runtimeStageText(job = {}, presentation = {}) {
    const snapshot = job.stage_snapshot;
    return firstNonEmptyText(presentation.detail, presentation.progressText, snapshot?.publicStage, job.display_stage);
}
export function buildJobDetailStatusViewModel(job = {}, eventsPayload = null) {
    const presentation = resolveDisplayedStagePresentation(job, eventsPayload);
    return {
        stageDetail: presentation.detail || "-",
        runtimeCurrentStage: summarizeRuntimeField(runtimeStageText(job, presentation)),
        progressText: presentation.progressText || "",
        stageKey: presentation.stageKey || "",
        visualStageKey: presentation.visualStageKey || presentation.stageKey || "",
    };
}
export function buildJobDetailEventViewModel(item = {}) {
    const record = normalizedStageEventRecord(item);
    const snapshot = adaptJobEventStageSnapshot(item);
    const progressCurrent = numberOrNull(snapshot.progress?.current);
    const progressTotal = numberOrNull(snapshot.progress?.total);
    const progressUnit = `${snapshot.progress?.unit || ""}`.trim();
    return {
        event: firstNonEmptyText(item.event, item.raw_event_type, item.event_type) || "-",
        level: firstNonEmptyText(item.level) || "-",
        timestamp: record.timestamp,
        stageText: record.stageText,
        displayStage: snapshot.publicStage || "",
        substage: snapshot.substage || record.substage,
        lane: snapshot.lane || record.lane,
        eventType: firstNonEmptyText(item.event_type),
        rawEventType: firstNonEmptyText(item.raw_event_type),
        provider: firstNonEmptyText(item.provider),
        providerStage: firstNonEmptyText(item.provider_stage),
        message: firstNonEmptyText(item.message) || "-",
        payload: item.payload,
        progressCurrent,
        progressTotal,
        progressUnit,
        progressText: record.progressText,
        retryCount: numberOrNull(item?.retry_count),
        elapsedMs: numberOrNull(item?.elapsed_ms),
        seq: item?.seq ?? "-",
    };
}
