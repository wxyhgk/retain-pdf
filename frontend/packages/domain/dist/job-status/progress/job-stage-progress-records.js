import { shouldReplaceCurrentStageProgress, shouldReplaceStageProgress, } from "./job-stage-progress-replacement.js";
import { normalizeProgressRecordFromEventRecord, } from "../contract/job-stage-progress-record-normalizer.js";
import { eventStageForMatchRecord, normalizedStageEventRecord, } from "../job-stage-event-record.js";
import { stageProgressAdapterFor } from "./stage-progress-adapters.js";
function recordStageForProgress(record) {
    return eventStageForMatchRecord(record);
}
export function collectLatestCurrentStageProgress(job, eventsPayload, stageKey = "", substageKey = "") {
    const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
    const stageContext = {
        latest: null,
        latestSameSubstage: null,
        requestedSubstageKey: substageKey,
        mode: "current",
    };
    const adapter = stageProgressAdapterFor(stageKey);
    for (const item of items) {
        const record = normalizedStageEventRecord(item);
        if (!record.isMainLane) {
            continue;
        }
        const itemStage = recordStageForProgress(record);
        if (!itemStage) {
            continue;
        }
        const next = normalizeProgressRecordFromEventRecord(job, record, itemStage);
        if (!next || next.stageKey !== stageKey) {
            continue;
        }
        adapter.record(stageContext, next, {
            shouldReplaceCurrentStageProgress,
            shouldReplaceStageProgress,
        });
    }
    return adapter.current(stageContext);
}
export function collectStageProgressByKey(job, eventsPayload) {
    const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
    const contextsByKey = {};
    for (const item of items) {
        const record = normalizedStageEventRecord(item);
        if (!record.isMainLane) {
            continue;
        }
        const itemStage = recordStageForProgress(record);
        if (!itemStage) {
            continue;
        }
        const nextProgress = normalizeProgressRecordFromEventRecord(job, record, itemStage);
        if (!nextProgress) {
            continue;
        }
        const { stageKey } = nextProgress;
        const context = contextsByKey[stageKey] || {
            latest: null,
            latestSameSubstage: null,
            requestedSubstageKey: "",
            mode: "summary",
        };
        stageProgressAdapterFor(stageKey).record(context, nextProgress, {
            shouldReplaceCurrentStageProgress,
            shouldReplaceStageProgress,
        });
        contextsByKey[stageKey] = context;
    }
    const progressByKey = {};
    Object.entries(contextsByKey).forEach(([stageKey, context]) => {
        const progress = stageProgressAdapterFor(stageKey).final(context);
        if (progress) {
            progressByKey[stageKey] = progress;
        }
    });
    return progressByKey;
}
