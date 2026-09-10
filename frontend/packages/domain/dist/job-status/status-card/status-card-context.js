import { createSelector } from "../../internal/selector.js";
import { summarizePublicError } from "../../job/diagnostics.js";
import { buildJobStatusViewModel } from "./job-status-view-model.js";
import { resolveSafeStatusCardStagePresentation, } from "./status-card-stage-presentation.js";
export function resolveStatusCardStagePresentation({ state, job, jobId, events, stagePresentation = null, } = {}) {
    return resolveSafeStatusCardStagePresentation({
        state,
        job,
        jobId,
        events,
        stagePresentation,
    });
}
export function buildStatusCardRenderModel({ state, job, jobId, events, manifest, stageActions, publicErrorText = "", stagePresentation = null, finishedAtFallback = "", } = {}) {
    const resolvedStagePresentation = resolveStatusCardStagePresentation({
        state,
        job,
        jobId,
        events: events,
        stagePresentation,
    });
    return buildJobStatusViewModel({
        state,
        job,
        jobId,
        events: events,
        manifest: manifest,
        stageActions,
        publicErrorText,
        stagePresentation: resolvedStagePresentation,
        finishedAtFallback,
    });
}
export function buildStatusCardPatchPayload({ state, job, jobId, events, manifest, stageActions, publicErrorText = null, stagePresentation = null, finishedAtFallback = "", } = {}) {
    const resolvedPublicErrorText = publicErrorText === null
        ? summarizePublicError(job)
        : publicErrorText;
    const statusViewModel = buildStatusCardRenderModel({
        state,
        job,
        jobId,
        events,
        manifest,
        stageActions,
        publicErrorText: resolvedPublicErrorText,
        stagePresentation,
        finishedAtFallback,
    });
    return {
        job,
        jobId,
        events,
        manifest,
        stageActions,
        publicErrorText: resolvedPublicErrorText,
        statusViewModel,
        stagePresentation: statusViewModel.stagePresentation,
    };
}
export function createStatusCardViewModelSelector() {
    return createSelector([
        (context) => context?.state,
        (context) => context?.job,
        (context) => context?.jobId,
        (context) => context?.events,
        (context) => context?.manifest,
        (context) => context?.stageActions,
        (context) => context?.publicErrorText ?? "",
        (context) => context?.stagePresentation ?? null,
        (context) => context?.finishedAtFallback ?? "",
    ], (state, job, jobId, events, manifest, stageActions, publicErrorText, stagePresentation, finishedAtFallback) => buildStatusCardRenderModel({
        state,
        job: job,
        jobId: jobId,
        events: events,
        manifest: manifest,
        stageActions,
        publicErrorText: publicErrorText,
        stagePresentation: stagePresentation,
        finishedAtFallback: finishedAtFallback,
    }));
}
