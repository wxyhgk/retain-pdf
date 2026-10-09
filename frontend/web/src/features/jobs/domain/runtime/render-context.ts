import type { JobPayload } from "@retainpdf/domain/job";
import type { EventsPayload } from "@retainpdf/domain/job-status";
import type { JobPresentationPort } from "./job-presentation.js";
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

/** 快照写入输入：payload 是原始任务回包，副资源可缺省 */
export interface JobRuntimeSnapshotInput {
  payload?: unknown;
  eventsPayload?: unknown;
  manifestPayload?: unknown;
  stageActionsPayload?: unknown;
}

/** 副资源写入输入：按 jobId 写入，任务快照已在 state 中 */
export interface JobRuntimeSecondaryInput {
  jobId?: string;
  eventsPayload?: unknown;
  manifestPayload?: unknown;
  stageActionsPayload?: unknown;
}

function resolveElapsedStart(job) {
  return (job?.started_at || job?.created_at || "").trim();
}

function syncEventsPayload(state: object, jobId: unknown, eventsPayload: unknown): EventsPayload | null {
  // 副资源 store 对 events 的回写类型是 unknown；这里按 EventsPayload 收窄（读取方已按此使用）。
  return syncSecondaryResource(state, "events", jobId, eventsPayload) as EventsPayload | null;
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
}: JobRuntimeSnapshotInput & { state: object; jobPresentationPort?: JobPresentationPort }) {
  const normalizeJobPayload: (value: unknown) => JobPayload = jobPresentationPort.normalizeJobPayload
    || ((value: unknown) => (value || {}) as JobPayload);
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
}: JobRuntimeSecondaryInput & { state: object }) {
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
    events: cachedEventsFor(state, resolvedJobId) as EventsPayload | null,
    manifest: cachedManifestFor(state, resolvedJobId),
    stageActions: cachedStageActionsFor(state, resolvedJobId),
  };
}

export function createJobRenderContextPort(
  state: object,
  { jobPresentationPort = {} }: { jobPresentationPort?: JobPresentationPort } = {},
) {
  return Object.freeze({
    applySnapshot({
      payload,
      eventsPayload = null,
      manifestPayload = null,
      stageActionsPayload = null,
    }: JobRuntimeSnapshotInput) {
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
    }: JobRuntimeSecondaryInput) {
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

/** 渲染端口与其单帧产物类型（poll 帧 / 副资源调度共用） */
export type JobRenderContextPort = ReturnType<typeof createJobRenderContextPort>;
export type JobRenderContext = ReturnType<JobRenderContextPort["applySnapshot"]>;
