import {
  cachedEventsFor,
  cachedManifestFor,
  cachedStageActionsFor,
  syncSecondaryResource,
} from "./secondary-resource-cache.js";
import {
  currentJobId,
  currentJobSnapshotFor,
  syncCurrentJobSnapshot,
} from "./current-job-state.js";

function resolveElapsedStart(job) {
  return (job?.started_at || job?.created_at || "").trim();
}

function syncEventsPayload(state, jobId, eventsPayload) {
  return syncSecondaryResource(state, "events", jobId, eventsPayload);
}

function syncManifestPayload(state, jobId, manifestPayload) {
  return syncSecondaryResource(state, "manifest", jobId, manifestPayload);
}

function syncStageActionsPayload(state, jobId, stageActionsPayload) {
  return syncSecondaryResource(state, "stageActions", jobId, stageActionsPayload);
}

export function applyJobRuntimeSnapshot({
  state,
  payload,
  eventsPayload = null,
  manifestPayload = null,
  stageActionsPayload = null,
  jobPresentationPort = {},
}: any) {
  const normalizeJobPayload = jobPresentationPort.normalizeJobPayload || ((value) => value || {});
  const job = normalizeJobPayload(payload);
  const jobId = job.job_id || currentJobId(state);
  syncCurrentJobSnapshot(state, job, jobId, {
    startedAt: resolveElapsedStart(job),
    finishedAt: job.finished_at || job.updated_at || "",
  });
  return {
    job,
    jobId,
    events: syncEventsPayload(state, jobId, eventsPayload),
    manifest: syncManifestPayload(state, jobId, manifestPayload),
    stageActions: syncStageActionsPayload(state, jobId, stageActionsPayload),
  };
}

export function applyJobSecondaryResources({
  state,
  jobId,
  eventsPayload = null,
  manifestPayload = null,
  stageActionsPayload = null,
}: any) {
  const resolvedJobId = `${jobId || currentJobId(state) || ""}`.trim();
  const job = currentJobSnapshotFor(state, resolvedJobId);
  if (!job || !resolvedJobId) {
    return {
      job: null,
      jobId: resolvedJobId,
      events: null,
      manifest: null,
      stageActions: null,
    };
  }
  return {
    job,
    jobId: resolvedJobId,
    events: syncEventsPayload(state, resolvedJobId, eventsPayload),
    manifest: syncManifestPayload(state, resolvedJobId, manifestPayload),
    stageActions: syncStageActionsPayload(state, resolvedJobId, stageActionsPayload),
  };
}

export function currentJobRenderContextFor(state, jobId) {
  const resolvedJobId = `${jobId || currentJobId(state) || ""}`.trim();
  const job = currentJobSnapshotFor(state, resolvedJobId);
  if (!job || !resolvedJobId) {
    return {
      job: null,
      jobId: resolvedJobId,
      events: null,
      manifest: null,
      stageActions: null,
    };
  }
  return {
    job,
    jobId: resolvedJobId,
    events: cachedEventsFor(state, resolvedJobId),
    manifest: cachedManifestFor(state, resolvedJobId),
    stageActions: cachedStageActionsFor(state, resolvedJobId),
  };
}

export function createJobRenderContextPort(state, { jobPresentationPort = {} }: any = {}) {
  return Object.freeze({
    applySnapshot({
      payload,
      eventsPayload = null,
      manifestPayload = null,
      stageActionsPayload = null,
    }) {
      return applyJobRuntimeSnapshot({
        state,
        payload,
        eventsPayload,
        manifestPayload,
        stageActionsPayload,
        jobPresentationPort,
      });
    },
    applySecondary({
      jobId,
      eventsPayload = null,
      manifestPayload = null,
      stageActionsPayload = null,
    }) {
      return applyJobSecondaryResources({
        state,
        jobId,
        eventsPayload,
        manifestPayload,
        stageActionsPayload,
      });
    },
    currentFor(jobId) {
      return currentJobRenderContextFor(state, jobId);
    },
  });
}

export const syncJobRenderCache = applyJobRuntimeSnapshot;
export const syncJobSecondaryRenderCache = applyJobSecondaryResources;
