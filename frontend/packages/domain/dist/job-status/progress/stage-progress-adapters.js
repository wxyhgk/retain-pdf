import { compareProgressEventOrder, } from "../presentation/job-stage-presentation-utils.js";
import { compositeOcrProgressFromRecord } from "./job-stage-ocr-progress.js";
import { compositeRenderCompileProgress, compositeRenderPageProgress, compositeRenderPrepareProgress, compositeRenderPrewarmProgress, compositeRenderProgressFromRecords, } from "./job-stage-render-progress.js";
import { compositeTranslationProgressFromRecord } from "./job-stage-translation-progress.js";
function baseAdapter() {
    return {
        record(stageContext, nextProgress, { shouldReplaceCurrentStageProgress, shouldReplaceStageProgress, } = {}) {
            const replaceLatest = stageContext.mode === "current"
                ? shouldReplaceCurrentStageProgress
                : shouldReplaceStageProgress || shouldReplaceCurrentStageProgress;
            if (replaceLatest?.(stageContext.latest, nextProgress)) {
                stageContext.latest = nextProgress;
            }
            if (stageContext.requestedSubstageKey
                && nextProgress.substageKey === stageContext.requestedSubstageKey
                && shouldReplaceCurrentStageProgress?.(stageContext.latestSameSubstage, nextProgress)) {
                stageContext.latestSameSubstage = nextProgress;
            }
        },
        current(stageContext) {
            return stageContext.latestSameSubstage || stageContext.latest || null;
        },
        final(stageContext) {
            return stageContext.latest || null;
        },
    };
}
const defaultStageProgressAdapter = baseAdapter();
const ocrStageProgressAdapter = {
    ...baseAdapter(),
    record(stageContext, nextProgress, options = {}) {
        defaultStageProgressAdapter.record(stageContext, nextProgress, options);
        if (!nextProgress.substageKey) {
            return;
        }
        const bySubstage = stageContext.bySubstage || {};
        if (compareProgressEventOrder(bySubstage[nextProgress.substageKey], nextProgress) > 0) {
            bySubstage[nextProgress.substageKey] = nextProgress;
        }
        stageContext.bySubstage = bySubstage;
    },
    current(stageContext) {
        return compositeOcrProgressFromRecord(stageContext.latestSameSubstage || stageContext.latest || null);
    },
    final(stageContext) {
        const preferredProgress = stageContext.latest || null;
        const bySubstage = stageContext.bySubstage || {};
        const normalizedBySubstage = Object.fromEntries(Object.entries(bySubstage).map(([substageKey, record]) => [
            substageKey,
            compositeOcrProgressFromRecord(record),
        ]));
        if (!preferredProgress && Object.keys(normalizedBySubstage).length === 0) {
            return null;
        }
        return {
            ...compositeOcrProgressFromRecord(preferredProgress),
            bySubstage: normalizedBySubstage,
        };
    },
};
const translationStageProgressAdapter = {
    ...baseAdapter(),
    record(stageContext, nextProgress, options = {}) {
        defaultStageProgressAdapter.record(stageContext, nextProgress, options);
        if (!nextProgress.substageKey) {
            return;
        }
        const bySubstage = stageContext.bySubstage || {};
        if (compareProgressEventOrder(bySubstage[nextProgress.substageKey], nextProgress) > 0) {
            bySubstage[nextProgress.substageKey] = nextProgress;
        }
        stageContext.bySubstage = bySubstage;
    },
    current(stageContext) {
        return compositeTranslationProgressFromRecord(stageContext.latestSameSubstage || stageContext.latest || null);
    },
    final(stageContext) {
        const preferredProgress = stageContext.latest || null;
        const bySubstage = stageContext.bySubstage || {};
        const normalizedBySubstage = Object.fromEntries(Object.entries(bySubstage).map(([substageKey, record]) => [
            substageKey,
            compositeTranslationProgressFromRecord(record),
        ]));
        if (!preferredProgress && Object.keys(normalizedBySubstage).length === 0) {
            return null;
        }
        return {
            ...compositeTranslationProgressFromRecord(preferredProgress),
            bySubstage: normalizedBySubstage,
        };
    },
};
const renderStageProgressAdapter = {
    ...baseAdapter(),
    record(stageContext, nextProgress, { shouldReplaceCurrentStageProgress, shouldReplaceStageProgress, } = {}) {
        defaultStageProgressAdapter.record(stageContext, nextProgress, { shouldReplaceCurrentStageProgress, shouldReplaceStageProgress });
        const records = stageContext.renderRecords || {};
        if (nextProgress.substageKey === "render_prepare"
            && nextProgress.progressUnit === "step"
            && shouldReplaceCurrentStageProgress?.(records.prepare, nextProgress)) {
            records.prepare = nextProgress;
        }
        if (nextProgress.substageKey === "render_prewarm"
            && nextProgress.progressUnit === "step"
            && shouldReplaceCurrentStageProgress?.(records.prewarm, nextProgress)) {
            records.prewarm = nextProgress;
        }
        if (nextProgress.progressUnit === "page"
            && shouldReplaceCurrentStageProgress?.(records.pages, nextProgress)) {
            records.pages = nextProgress;
        }
        if (nextProgress.substageKey === "render_compile"
            && nextProgress.progressUnit === "step"
            && shouldReplaceCurrentStageProgress?.(records.compile, nextProgress)) {
            records.compile = nextProgress;
        }
        stageContext.renderRecords = records;
    },
    current(stageContext) {
        return compositeRenderProgressFromRecords(stageContext.renderRecords || {}, stageContext.latestSameSubstage || stageContext.latest || null);
    },
    final(stageContext) {
        const records = stageContext.renderRecords || {};
        const progress = compositeRenderProgressFromRecords(records, stageContext.latest || null);
        if (!progress) {
            return null;
        }
        return {
            ...progress,
            bySubstage: {
                ...(records.prepare ? { render_prepare: compositeRenderPrepareProgress(records.prepare) || records.prepare } : {}),
                ...(records.prewarm ? { render_prewarm: compositeRenderPrewarmProgress(records.prewarm) || records.prewarm } : {}),
                ...(records.pages ? { render_pages: compositeRenderPageProgress(records.pages) || records.pages } : {}),
                ...(records.compile ? { render_compile: compositeRenderCompileProgress(records.compile) || records.compile } : {}),
            },
        };
    },
};
export function stageProgressAdapterFor(stageKey = "") {
    if (stageKey === "ocr") {
        return ocrStageProgressAdapter;
    }
    if (stageKey === "translate") {
        return translationStageProgressAdapter;
    }
    if (stageKey === "render") {
        return renderStageProgressAdapter;
    }
    return defaultStageProgressAdapter;
}
