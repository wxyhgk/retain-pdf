import { compositeRenderCompileProgress, compositeRenderPageProgress, compositeRenderPrepareProgress, compositeRenderPrewarmProgress, } from "./progress/job-stage-render-progress.js";
import { compositeTranslationProgressFromRecord } from "./progress/job-stage-translation-progress.js";
function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : NaN;
}
function hasMeasurableProgress(progress = {}) {
    const current = finiteNumber(progress.current ?? progress.progressCurrent);
    const total = finiteNumber(progress.total ?? progress.progressTotal);
    return Number.isFinite(current) && Number.isFinite(total) && total > 0;
}
function normalizeProgress(progress = {}) {
    return {
        current: progress.current,
        total: progress.total,
        displayPercent: progress.displayPercent ?? null,
        progressText: progress.progressText || "",
        progressUnit: progress.progressUnit || "",
        indeterminate: Boolean(progress.indeterminate ?? progress.progressIndeterminate),
        substageKey: progress.substageKey || "",
        visualStageKey: progress.visualStageKey || "",
        bySubstage: progress.bySubstage || {},
    };
}
function snapshotProgressRecord(snapshot = {}) {
    return {
        stageKey: snapshot.stageKey,
        current: snapshot.progressCurrent,
        total: snapshot.progressTotal,
        displayPercent: snapshot.displayPercent,
        progressText: snapshot.progressText,
        progressUnit: snapshot.progressUnit,
        indeterminate: Boolean(snapshot.progressIndeterminate),
        substageKey: snapshot.substageKey,
        visualStageKey: snapshot.visualStageKey,
    };
}
function compositeSnapshotProgress(snapshot = {}) {
    const record = snapshotProgressRecord(snapshot);
    if (record.stageKey === "translate") {
        return compositeTranslationProgressFromRecord(record) || record;
    }
    if (record.stageKey !== "render") {
        return record;
    }
    if (record.substageKey === "render_compile") {
        return compositeRenderCompileProgress(record) || record;
    }
    if (record.substageKey === "render_prepare") {
        return compositeRenderPrepareProgress(record) || record;
    }
    if (record.substageKey === "render_prewarm") {
        return compositeRenderPrewarmProgress(record) || record;
    }
    if (record.substageKey === "render_pages" || record.progressUnit === "page") {
        return compositeRenderPageProgress({
            ...record,
            substageKey: record.substageKey || "render_pages",
        }) || record;
    }
    return record;
}
function isSuccessfulDoneStatus(status = "") {
    const normalized = `${status || ""}`.trim().toLowerCase();
    return !["failed", "canceled", "cancelled", "error"].includes(normalized);
}
export function currentStageProgressViewModel(snapshot = {}, { normalizeSelectedProgress } = {}) {
    const currentProgress = normalizeProgress(compositeSnapshotProgress(snapshot));
    if (snapshot.stageKey !== "done") {
        return currentProgress;
    }
    const renderProgress = normalizeSelectedProgress?.(snapshot.stageProgressByKey?.render) || {};
    const renderVisualStageKey = renderProgress.visualStageKey || currentProgress.visualStageKey || "render_compile";
    if (isSuccessfulDoneStatus(snapshot.status)) {
        return {
            ...currentProgress,
            current: 100,
            total: 100,
            displayPercent: 100,
            progressText: "渲染完成",
            progressUnit: "percent",
            visualStageKey: renderVisualStageKey,
            substageKey: renderProgress.substageKey || currentProgress.substageKey || "render_compile",
        };
    }
    if (!hasMeasurableProgress(renderProgress)) {
        return {
            ...currentProgress,
            current: 100,
            total: 100,
            displayPercent: 100,
            progressText: currentProgress.progressText || "渲染完成",
            progressUnit: currentProgress.progressUnit || "percent",
            visualStageKey: renderVisualStageKey,
            substageKey: currentProgress.substageKey || "render_compile",
        };
    }
    return {
        ...renderProgress,
        progressText: renderProgress.progressText || "渲染完成",
        visualStageKey: renderVisualStageKey,
    };
}
