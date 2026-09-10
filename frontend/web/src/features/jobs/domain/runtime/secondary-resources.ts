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
  mergeJobEventsPayload,
} from "./job-events-resource.js";
import {
  createSecondaryResourceStatePort,
} from "./secondary-resource-cache.js";

function defaultBuildJobPatchWithDisplayState(job: any = {}) {
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
}: any) {
  const buildJobPatchWithDisplayState = jobPresentationPort.buildJobPatchWithDisplayState
    || defaultBuildJobPatchWithDisplayState;
  const cachedManifest = secondaryResourcePort.cachedFor("manifest", jobId);
  const cachedStageActions = secondaryResourcePort.cachedFor("stageActions", jobId);

  if (!secondaryResourcePort.isInFlight("events") && secondaryResourcePort.shouldRefresh("events", JOB_EVENTS_REFRESH_MS, true)) {
    secondaryResourcePort.setInFlight("events", true, generation);
    const eventsGeneration = generation;
    const eventsResource = jobEventsResource || createJobEventsResource({
      fetchJobEvents,
      apiPrefix,
    });
    void eventsResource.load({ jobId, terminal }, { cache: false })
      .then((eventsSnapshot) => {
        if (!pollingPort.isCurrentGeneration(jobId, eventsGeneration)) {
          return;
        }
        if (eventsSnapshot?.status === "error") {
          throw eventsSnapshot.error || new Error("job events resource failed");
        }
        const eventsPayload = eventsSnapshot?.data || { items: [] };
        const mergedEventsPayload = mergeJobEventsPayload(secondaryResourcePort.cachedFor("events", jobId), eventsPayload);
        secondaryResourcePort.cache("events", jobId, mergedEventsPayload, eventsGeneration);
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
}: any) {
  return Object.freeze({
    schedule({
      jobId,
      payload,
      generation,
      terminal,
    }) {
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
