import { summarizeStageKey, stageSubtypeOf, } from "../summary/job-status-summary.js";
import { progressTextForStageProgress, } from "../summary/job-status-summary-progress.js";
import { publicProgressOf, } from "./job-stage-progress-adapter.js";
import { substageDefaultProgressUnit } from "../contract/job-stage-substage-contract.js";
import { compositeTranslationProgressFromRecord } from "./job-stage-translation-progress.js";
function concreteProgressUnit(unit = "") {
    return ["page", "batch", "step", "none"].includes(`${unit || ""}`.trim());
}
export function jobProgress(job = {}) {
    const progress = publicProgressOf(job);
    return {
        current: progress.current,
        total: progress.total,
    };
}
export function stageFallbackProgress(_stageKey, _job = {}) {
    return null;
}
export function shouldPreferJobProgress(job, stageKey, latestProgress, { currentEventRecord = null, } = {}) {
    if (!["ocr", "translate", "render"].includes(stageKey)) {
        return false;
    }
    if (currentEventRecord?.hasCanonicalEventContract
        && currentEventRecord.isMainLane
        && currentEventRecord.canonicalDisplayStage === stageKey) {
        return false;
    }
    if (stageKey === "render") {
        return false;
    }
    if (summarizeStageKey(job) !== stageKey) {
        return false;
    }
    const fallback = jobProgress(job || {});
    if (fallback.current === null || fallback.total === null || fallback.total <= 0) {
        return false;
    }
    if (stageKey === "translate" && latestProgress?.substageKey) {
        const jobSubstage = stageSubtypeOf(job);
        if (jobSubstage && jobSubstage !== latestProgress.substageKey) {
            return false;
        }
    }
    if (stageKey === "translate" && (latestProgress?.progressUnit === "batch" || latestProgress?.sourceProgressUnit === "batch")) {
        const jobProgressUnit = publicProgressOf(job || {}).unit;
        const jobSubstage = stageSubtypeOf(job);
        if (jobProgressUnit !== "batch") {
            return false;
        }
        if (jobSubstage && jobSubstage !== "translation_batches") {
            return false;
        }
    }
    if (stageKey === "translate" && latestProgress?.progressUnit) {
        const jobSubstage = stageSubtypeOf(job);
        const jobProgressUnit = publicProgressOf(job || {}).unit || substageDefaultProgressUnit(jobSubstage);
        const latestProgressUnit = latestProgress.sourceProgressUnit || latestProgress.progressUnit;
        if (concreteProgressUnit(latestProgressUnit) && jobProgressUnit && jobProgressUnit !== latestProgressUnit) {
            return false;
        }
    }
    if (!latestProgress) {
        return true;
    }
    if (latestProgress.current === null || latestProgress.total === null || latestProgress.total <= 0) {
        return true;
    }
    if (fallback.total !== latestProgress.total) {
        return fallback.current / fallback.total >= Number(latestProgress.current) / Number(latestProgress.total);
    }
    return fallback.current >= Number(latestProgress.current);
}
export function jobProgressRecord(job, stageKey) {
    const progress = jobProgress(job || {});
    const publicProgress = publicProgressOf(job || {});
    const progressUnit = publicProgress.unit || (stageKey === "translate" ? "batch" : "page");
    if (progress.current === null || progress.total === null || progress.total <= 0) {
        if (stageKey !== "translate" || (!progressUnit && !stageSubtypeOf(job))) {
            return null;
        }
    }
    if (stageKey !== "translate" && (progress.current === null || progress.total === null || progress.total <= 0)) {
        return null;
    }
    const payload = {
        ...(job || {}),
        progress_current: progress.current,
        progress_total: progress.total,
        progress_unit: progressUnit,
    };
    const substageKey = stageSubtypeOf(payload);
    const record = {
        payload,
        current: progress.current,
        total: progress.total,
        progressPercent: publicProgress.percent,
        progressUnit: payload.progress_unit,
        progressText: progressTextForStageProgress({
            stageKey,
            substageKey,
            progress: {
                current: progress.current,
                total: progress.total,
                percent: publicProgress.percent,
                unit: payload.progress_unit,
            },
        }),
        stageKey,
        substageKey,
    };
    return stageKey === "translate"
        ? (compositeTranslationProgressFromRecord(record) ?? null)
        : record;
}
