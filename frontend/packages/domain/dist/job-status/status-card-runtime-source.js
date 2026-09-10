import { buildStatusCardPatchPayload, buildStatusCardRenderModel, } from "./status-card/status-card-context.js";
export function secondaryPayloadForStatusCardJob(secondarySnapshot = {}, type = "", jobId = "") {
    const raw = secondarySnapshot?.[type] || null;
    const record = (raw && typeof raw === "object")
        ? raw
        : null;
    return record?.jobId === jobId ? record.payload : null;
}
export function finishedAtFallbackForStatusCardRuntime(runtime = null) {
    return typeof runtime?.finishedAtFallback === "function"
        ? runtime.finishedAtFallback()
        : "";
}
export function buildRuntimeStatusCardViewModel({ runtime, job, jobId, events, manifest, stageActions, publicErrorText = "", stagePresentation = null, } = {}) {
    return buildStatusCardRenderModel({
        state: runtime?.state || null,
        job,
        jobId,
        events,
        manifest,
        stageActions,
        publicErrorText,
        stagePresentation,
        finishedAtFallback: finishedAtFallbackForStatusCardRuntime(runtime),
    });
}
export function buildRuntimeStatusCardPatchPayload({ runtime, job, jobId, events, manifest, stageActions, } = {}) {
    return buildStatusCardPatchPayload({
        state: runtime?.state || null,
        job,
        jobId,
        events,
        manifest,
        stageActions,
        finishedAtFallback: finishedAtFallbackForStatusCardRuntime(runtime),
    });
}
export function buildRuntimeStatusCardSnapshot({ currentJob, presentationOverride, secondaryResources, state = null, finishedAtFallback = "", } = {}) {
    const jobId = `${currentJob?.jobId || ""}`.trim();
    const job = currentJob?.snapshot || null;
    if (!job || !jobId) {
        return null;
    }
    return buildRuntimeStatusCardViewModel({
        runtime: {
            state,
            finishedAtFallback: typeof finishedAtFallback === "function"
                ? finishedAtFallback
                : () => finishedAtFallback,
        },
        job,
        jobId,
        events: secondaryPayloadForStatusCardJob(secondaryResources, "events", jobId),
        manifest: secondaryPayloadForStatusCardJob(secondaryResources, "manifest", jobId),
        stageActions: secondaryPayloadForStatusCardJob(secondaryResources, "stageActions", jobId),
        publicErrorText: presentationOverride?.publicErrorText || "",
        stagePresentation: presentationOverride?.stagePresentation || null,
    });
}
