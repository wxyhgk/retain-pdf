import { eventStageForMatchRecord, normalizedStageEventRecord, } from "../job-stage-event-record.js";
import { normalizeProgressRecordFromEventRecord, } from "../contract/job-stage-progress-record-normalizer.js";
function clampRatio(current, total) {
    return Math.max(0, Math.min(1, current / total));
}
function validProgress(record) {
    return Boolean(record && record.current !== null && record.total !== null && record.total > 0);
}
export function compositeRenderCompileProgress(record) {
    const hasProgress = validProgress(record);
    if (!record || !hasProgress) {
        if (record?.substageKey !== "render_compile") {
            return null;
        }
    }
    if (!record) {
        return null;
    }
    const compileRatio = hasProgress ? clampRatio(Number(record.current), Number(record.total)) : 0;
    const percent = 80 + Math.round(compileRatio * 20);
    const compileDone = hasProgress && Number(record.current) >= Number(record.total);
    const compileText = compileDone ? "渲染完成" : "正在编译 PDF";
    const payload = (record.payload && typeof record.payload === "object")
        ? record.payload
        : {};
    return {
        ...record,
        current: percent,
        total: 100,
        progressUnit: "percent",
        displayPercent: percent,
        progressText: compileText,
        payload: {
            ...payload,
            stage_detail: compileText,
            progress_unit: "percent",
        },
        indeterminate: false,
    };
}
export function compositeRenderPageProgress(record) {
    if (!validProgress(record) || !record) {
        return null;
    }
    const pageRatio = clampRatio(Number(record.current), Number(record.total));
    const percent = 10 + Math.round(pageRatio * 70);
    const payload = (record.payload && typeof record.payload === "object")
        ? record.payload
        : {};
    return {
        ...record,
        current: percent,
        total: 100,
        progressUnit: "percent",
        displayPercent: percent,
        progressText: record.progressText,
        payload: {
            ...payload,
            progress_unit: "percent",
        },
        indeterminate: Number(record.current) <= 0,
    };
}
export function compositeRenderPrewarmProgress(record) {
    if (!validProgress(record) || !record) {
        return null;
    }
    const prewarmRatio = clampRatio(Number(record.current), Number(record.total));
    const percent = Math.round(prewarmRatio * 10);
    const prewarmText = `预热 ${record.current}/${record.total}`;
    const payload = (record.payload && typeof record.payload === "object")
        ? record.payload
        : {};
    return {
        ...record,
        current: percent,
        total: 100,
        progressUnit: "percent",
        displayPercent: percent,
        progressText: prewarmText,
        payload: {
            ...payload,
            stage_detail: prewarmText,
            progress_unit: "percent",
        },
        indeterminate: Number(record.current) <= 0,
    };
}
export function compositeRenderPrepareProgress(record) {
    if (!validProgress(record) || !record) {
        return null;
    }
    const prepareRatio = clampRatio(Number(record.current), Number(record.total));
    const percent = Math.round(prepareRatio * 10);
    const payload = (record.payload && typeof record.payload === "object")
        ? record.payload
        : {};
    return {
        ...record,
        current: percent,
        total: 100,
        progressUnit: "percent",
        displayPercent: percent,
        progressText: `准备 ${record.current}/${record.total}`,
        payload: {
            ...payload,
            progress_unit: "percent",
        },
        indeterminate: Number(record.current) <= 0,
    };
}
function shouldTrackRenderRecord(record, substageKey, progressUnit) {
    return record?.substageKey === substageKey && record?.progressUnit === progressUnit;
}
function selectRenderProgressRecords(job, eventsPayload, { shouldReplaceCurrentStageProgress, } = {}) {
    const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
    let latestPrepareProgress = null;
    let latestPrewarmProgress = null;
    let latestPageProgress = null;
    let latestCompileProgress = null;
    for (const item of items) {
        const record = normalizedStageEventRecord(item);
        if (!record.isMainLane) {
            continue;
        }
        const itemStage = eventStageForMatchRecord(record);
        if (!itemStage) {
            continue;
        }
        const next = normalizeProgressRecordFromEventRecord(job, record, itemStage);
        if (!next || next.stageKey !== "render") {
            continue;
        }
        if (shouldTrackRenderRecord(next, "render_prepare", "step")
            && shouldReplaceCurrentStageProgress(latestPrepareProgress, next)) {
            latestPrepareProgress = next;
        }
        if (shouldTrackRenderRecord(next, "render_prewarm", "step")
            && shouldReplaceCurrentStageProgress(latestPrewarmProgress, next)) {
            latestPrewarmProgress = next;
        }
        if (next.progressUnit === "page" && shouldReplaceCurrentStageProgress(latestPageProgress, next)) {
            latestPageProgress = next;
        }
        if (shouldTrackRenderRecord(next, "render_compile", "step")
            && shouldReplaceCurrentStageProgress(latestCompileProgress, next)) {
            latestCompileProgress = next;
        }
    }
    return {
        prepare: latestPrepareProgress,
        prewarm: latestPrewarmProgress,
        pages: latestPageProgress,
        compile: latestCompileProgress,
    };
}
export function compositeRenderProgressFromRecords(records = {}, fallbackProgress = null) {
    return compositeRenderCompileProgress(records.compile)
        || compositeRenderPageProgress(records.pages)
        || compositeRenderPrewarmProgress(records.prewarm)
        || compositeRenderPrepareProgress(records.prepare)
        || records.compile
        || records.pages
        || records.prewarm
        || records.prepare
        || fallbackProgress
        || null;
}
export function compositeRenderProgressFromEvents(job, eventsPayload, { fallbackProgress = null, shouldReplaceCurrentStageProgress, } = {}) {
    const records = selectRenderProgressRecords(job, eventsPayload, {
        shouldReplaceCurrentStageProgress,
    });
    return compositeRenderProgressFromRecords(records, fallbackProgress);
}
