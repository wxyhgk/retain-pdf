import { buildJobStatusViewModel } from "./job-status-view-model.js";
export function buildStatusCardSnapshot({ state, job, jobId, stagePresentation, events, manifest, stageActions, publicErrorText, finishedAtFallback = "", }) {
    return buildJobStatusViewModel({
        state,
        job,
        jobId,
        events,
        manifest,
        stageActions,
        publicErrorText,
        stagePresentation,
        finishedAtFallback,
    });
}
