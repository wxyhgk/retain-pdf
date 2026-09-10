import { collectStageProgressByKey, resolveDisplayedStagePresentation, } from "./job-stage-presentation.js";
import { normalizedStageEventRecord } from "../job-stage-event-record.js";
import { adaptJobStageSnapshot } from "../job-stage-contract-adapter.js";
import { progressTextForStageProgress, } from "../summary/job-status-summary-progress.js";
import { normalizeSubstageKey, substageDetail, } from "../contract/job-stage-substage-contract.js";
function normalizeBackgroundStagePayload(payload = {}) {
    const snapshot = adaptJobStageSnapshot(payload);
    const stageKey = snapshot.stageKey;
    if (!stageKey || !["ocr", "translate", "render"].includes(stageKey)) {
        return null;
    }
    const substageKey = normalizeSubstageKey(snapshot.substage || payload.substage || "");
    return {
        stageKey,
        substageKey,
        detail: substageDetail(substageKey) || snapshot.detail,
        progressText: progressTextForStageProgress({
            stageKey,
            substageKey,
            progress: snapshot.progress,
        }),
        progress: snapshot.progress,
        payload: {
            ...payload,
            display_stage: stageKey === "translate" ? "translation" : stageKey,
            substage: substageKey || snapshot.substage || payload.substage,
            progress: snapshot.progress,
        },
    };
}
function collectBackgroundStages(job = {}, eventsPayload = {}) {
    const byKey = new Map();
    const append = (item = {}) => {
        const normalized = normalizeBackgroundStagePayload(item);
        if (!normalized) {
            return;
        }
        const key = `${normalized.stageKey}:${normalized.substageKey || ""}`;
        byKey.set(key, normalized);
    };
    const backgroundStages = Array.isArray(job?.background_stages) ? job.background_stages : [];
    backgroundStages.forEach((item) => append(item));
    const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
    items.forEach((item) => {
        const record = normalizedStageEventRecord(item);
        if (record.lane !== "background") {
            return;
        }
        append({
            ...item,
            display_stage: record.publicStage || item.display_stage,
            substage: record.substage || item.substage,
            progress: {
                unit: record.progressUnit,
                current: record.progress?.current ?? null,
                total: record.progress?.total ?? null,
            },
        });
    });
    return Array.from(byKey.values());
}
export function resolveJobDisplayState(job = {}, eventsPayload = null) {
    const safeEvents = eventsPayload || {};
    const stagePresentation = resolveDisplayedStagePresentation(job, safeEvents);
    const stageProgressByKey = collectStageProgressByKey(job, safeEvents);
    return {
        job,
        events: safeEvents,
        mainStageKey: stagePresentation.stageKey,
        mainSubstageKey: stagePresentation.substageKey,
        stagePresentation,
        stageProgressByKey,
        backgroundStages: collectBackgroundStages(job, safeEvents),
    };
}
export function buildJobPatchWithDisplayState(job = {}, eventsPayload = null) {
    const displayState = resolveJobDisplayState(job, eventsPayload);
    const presentation = displayState.stagePresentation || {};
    const publicStage = presentation.stageKey === "translate"
        ? "translation"
        : ["ocr", "render", "done"].includes(presentation.stageKey)
            ? presentation.stageKey
            : "";
    const progress = {
        unit: presentation.progressUnit || "",
        current: presentation.progressCurrent ?? null,
        total: presentation.progressTotal ?? null,
        percent: presentation.progressPercent ?? presentation.displayPercent ?? null,
    };
    return {
        ...job,
        display_stage: publicStage || job.display_stage || "",
        substage: presentation.substageKey || job.substage || "",
        stage_snapshot: {
            stageKey: presentation.stageKey || "",
            publicStage,
            source: "display-state",
            lane: "main",
            substage: presentation.substageKey || "",
            detail: presentation.detail || "",
            progress,
        },
        progress,
        background_stages: displayState.backgroundStages,
    };
}
