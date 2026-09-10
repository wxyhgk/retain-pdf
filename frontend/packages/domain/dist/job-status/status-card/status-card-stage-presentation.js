import { resolveRenderStagePresentation } from "../presentation/job-render-stage-presentation.js";
function normalizeStageKey(value = "") {
    return `${value || ""}`.trim();
}
function sameStage(base = {}, override = {}) {
    const baseStage = normalizeStageKey(base.stageKey);
    const overrideStage = normalizeStageKey(override.stageKey);
    return Boolean(baseStage && overrideStage && baseStage === overrideStage);
}
function mergeSameStagePresentation(base = {}, override = {}) {
    if (!sameStage(base, override)) {
        return base;
    }
    return {
        ...base,
        ...override,
        stageKey: base.stageKey,
        visualStageKey: override.visualStageKey
            || base.visualStageKey,
        stageKeyTrusted: base.stageKeyTrusted,
        stageProgressByKey: base.stageProgressByKey,
        backgroundStages: base.backgroundStages,
    };
}
export function resolveSafeStatusCardStagePresentation({ state, job, jobId, events, stagePresentation = null, } = {}) {
    const resolved = resolveRenderStagePresentation({
        state,
        job,
        jobId,
        events,
    });
    return mergeSameStagePresentation(resolved, stagePresentation || {});
}
