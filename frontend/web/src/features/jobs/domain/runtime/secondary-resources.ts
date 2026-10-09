import type { JobLike, JobPayload } from "@retainpdf/domain/job";
import type { fetchJobEvents as FetchJobEvents } from "@retainpdf/api/jobs-events";
import type { JobEventsResource } from "./job-events-resource.js";
import type { JobPresentationPort } from "./job-presentation.js";
import type { JobRenderContextPort } from "./render-context.js";
import type { RuntimePollingStatePort } from "./runtime-polling-state.js";
import type { CurrentJobStatePort } from "./current-job-state.js";
import {
  createCurrentJobStatePort,
} from "./current-job-state.js";
import {
  createJobRenderContextPort,
} from "./render-context.js";
import {
  JOB_EVENTS_REFRESH_MS,
  JOB_MANIFEST_REFRESH_MS,
  JOB_STAGE_ACTIONS_REFRESH_MS,
} from "./secondary-resource-policy.js";
import { createRuntimePollingStatePort } from "./runtime-polling-state.js";
import {
  createJobEventsResource,
} from "./job-events-resource.js";
import {
  createSecondaryResourceStatePort,
} from "./secondary-resource-cache.js";

export type SecondaryResourcePort = ReturnType<typeof createSecondaryResourceStatePort>;

/** 副资源调度依赖（scheduler 工厂与单次调度共用） */
export interface SecondaryResourceFetchDeps {
  state: object;
  apiPrefix?: string;
  fetchJobEvents: typeof FetchJobEvents;
  jobEventsResource?: JobEventsResource | null;
  fetchJobArtifactsManifest: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  fetchJobStageActions?: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  renderJobSecondaryPatch?: (patch: { context: unknown; source: string }) => void;
  notifyLibraryJobUpdated?: (job: JobLike | JobPayload) => void;
  pollingPort?: RuntimePollingStatePort;
  currentJobPort?: CurrentJobStatePort;
  secondaryResourcePort?: SecondaryResourcePort;
  renderContextPort?: JobRenderContextPort;
  jobPresentationPort?: JobPresentationPort;
}

/** 单次调度的参数：依赖 + 本帧任务信息 */
/** 单帧调度的任务信息 */
export interface SecondaryResourceScheduleArgs {
  jobId: string;
  payload?: unknown;
  generation: number;
  terminal: boolean;
}

export type ScheduleSecondaryResourceFetchesArgs = SecondaryResourceFetchDeps & SecondaryResourceScheduleArgs;

export type SecondaryResourceSchedulerPort = ReturnType<typeof createSecondaryResourceSchedulerPort>;

function defaultBuildJobPatchWithDisplayState(job: JobLike = {}) {
  return job;
}

export function scheduleSecondaryResourceFetches({
  state,
  apiPrefix,
  jobId,
  payload,
  generation,
  terminal,
  fetchJobEvents,
  jobEventsResource = null,
  fetchJobArtifactsManifest,
  fetchJobStageActions,
  renderJobSecondaryPatch,
  notifyLibraryJobUpdated,
  pollingPort = createRuntimePollingStatePort(state),
  currentJobPort = createCurrentJobStatePort(state),
  secondaryResourcePort = createSecondaryResourceStatePort(state),
  renderContextPort = createJobRenderContextPort(state),
  jobPresentationPort = {},
}: ScheduleSecondaryResourceFetchesArgs) {
  const buildJobPatchWithDisplayState = jobPresentationPort.buildJobPatchWithDisplayState
    || defaultBuildJobPatchWithDisplayState;
  const cachedManifest = secondaryResourcePort.cachedFor("manifest", jobId);
  const cachedStageActions = secondaryResourcePort.cachedFor("stageActions", jobId);
  const eventsResource = jobEventsResource || createJobEventsResource({ fetchJobEvents, apiPrefix });
  const terminalNeedsHistory = terminal && !eventsResource.hasFullHistory?.(jobId);
  const eventsOwner = secondaryResourcePort.getSnapshot?.()?.events?.ownerGen;
  // A terminal transition stops polling and advances its generation. Its one
  // full-history load must not be lost behind the previous generation's read.
  const canLoadEvents = !secondaryResourcePort.isInFlight("events")
    || (terminalNeedsHistory && eventsOwner !== generation);

  if (canLoadEvents && secondaryResourcePort.shouldRefresh("events", JOB_EVENTS_REFRESH_MS, terminalNeedsHistory)) {
    secondaryResourcePort.setInFlight("events", true, generation);
    const eventsGeneration = generation;
    const isCurrent = () => pollingPort.isCurrentGeneration(jobId, eventsGeneration);
    void eventsResource.load({ jobId, terminal, isCurrent, onReset: () => {
      if (!isCurrent()) return;
      secondaryResourcePort.cache("events", jobId, { items: [] }, eventsGeneration);
      renderJobSecondaryPatch?.({ context: renderContextPort.currentFor(jobId), source: "events" });
    } }, { cache: false })
      .then((eventsSnapshot) => {
        if (!pollingPort.isCurrentGeneration(jobId, eventsGeneration)) {
          return;
        }
        if (eventsSnapshot?.status === "error") {
          throw eventsSnapshot.error || new Error("job events resource failed");
        }
        const eventsPayload = eventsSnapshot?.data || { items: [] };
        // The resource owns cursor merging and epoch resets; never re-add stale events here.
        secondaryResourcePort.cache("events", jobId, eventsPayload, eventsGeneration);
        renderJobSecondaryPatch?.({
          context: renderContextPort.currentFor(jobId),
          source: "events",
        });
        // events 副资源只喂 StatusCard/Detail；图书馆卡片由主 poll 更新，
        // 避免 1s 双路 publishJobUpdated 导致网格抖。
      })
      .catch(() => {
        // Event stream is secondary; keep main status usable even if events fail.
      })
      .finally(() => {
        secondaryResourcePort.clearInFlightForCurrentJob("events", jobId, eventsGeneration);
      });
  }

  if (!secondaryResourcePort.isInFlight("manifest") && secondaryResourcePort.shouldRefresh("manifest", JOB_MANIFEST_REFRESH_MS, terminal || !cachedManifest)) {
    secondaryResourcePort.setInFlight("manifest", true, generation);
    const manifestGeneration = generation;
    void fetchJobArtifactsManifest(jobId, apiPrefix)
      .then((manifestPayload) => {
        if (!pollingPort.isCurrentGeneration(jobId, manifestGeneration)) {
          return;
        }
        secondaryResourcePort.cache("manifest", jobId, manifestPayload, manifestGeneration);
        renderJobSecondaryPatch?.({
          context: renderContextPort.currentFor(jobId),
          source: "manifest",
        });
      })
      .catch(() => {
        // Artifacts manifest is secondary; keep main status usable even if manifest fails.
      })
      .finally(() => {
        secondaryResourcePort.clearInFlightForCurrentJob("manifest", jobId, manifestGeneration);
      });
  }

  if (fetchJobStageActions && !secondaryResourcePort.isInFlight("stageActions") && secondaryResourcePort.shouldRefresh("stageActions", JOB_STAGE_ACTIONS_REFRESH_MS, terminal || !cachedStageActions)) {
    secondaryResourcePort.setInFlight("stageActions", true, generation);
    const stageActionsGeneration = generation;
    void fetchJobStageActions(jobId, apiPrefix)
      .then((stageActionsPayload) => {
        if (!pollingPort.isCurrentGeneration(jobId, stageActionsGeneration)) {
          return;
        }
        secondaryResourcePort.cache("stageActions", jobId, stageActionsPayload, stageActionsGeneration);
        renderJobSecondaryPatch?.({
          context: renderContextPort.currentFor(jobId),
          source: "stageActions",
        });
      })
      .catch(() => {
        // Stage actions are secondary; keep main status usable even if action discovery fails.
      })
      .finally(() => {
        secondaryResourcePort.clearInFlightForCurrentJob("stageActions", jobId, stageActionsGeneration);
      });
  }
}

export function createSecondaryResourceSchedulerPort({
  state,
  apiPrefix,
  fetchJobEvents,
  jobEventsResource = createJobEventsResource({ fetchJobEvents, apiPrefix }),
  fetchJobArtifactsManifest,
  fetchJobStageActions,
  renderJobSecondaryPatch,
  notifyLibraryJobUpdated,
  pollingPort = createRuntimePollingStatePort(state),
  currentJobPort = createCurrentJobStatePort(state),
  secondaryResourcePort = createSecondaryResourceStatePort(state),
  renderContextPort = createJobRenderContextPort(state),
  jobPresentationPort = {},
}: SecondaryResourceFetchDeps) {
  return Object.freeze({
    schedule({
      jobId,
      payload,
      generation,
      terminal,
    }: SecondaryResourceScheduleArgs) {
      return scheduleSecondaryResourceFetches({
        state,
        apiPrefix,
        jobId,
        payload,
        generation,
        terminal,
        fetchJobEvents,
        jobEventsResource,
        fetchJobArtifactsManifest,
        fetchJobStageActions,
        renderJobSecondaryPatch,
        notifyLibraryJobUpdated,
        pollingPort,
        currentJobPort,
        secondaryResourcePort,
        renderContextPort,
        jobPresentationPort,
      });
    },
  });
}
