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
    secondaryResourcePort.setInFlight("events", true);
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
        secondaryResourcePort.cache("events", jobId, mergedEventsPayload);
        renderJobSecondaryPatch?.({
          context: renderContextPort.currentFor(jobId),
          source: "events",
        });
        // events Chỉ nguồn cấp tài nguyên thứ cấp StatusCard/Detail；Thẻ thư viện của Master poll Cập nhật，
        // tránh cho 1s 2 chiều publishJobUpdated Gây rung lưới。
      })
      .catch(() => {
        // Event stream is secondary; keep main status usable even if events fail.
      })
      .finally(() => {
        secondaryResourcePort.clearInFlightForCurrentJob("events", jobId);
      });
  }

  if (!secondaryResourcePort.isInFlight("manifest") && secondaryResourcePort.shouldRefresh("manifest", JOB_MANIFEST_REFRESH_MS, terminal || !cachedManifest)) {
    secondaryResourcePort.setInFlight("manifest", true);
    const manifestGeneration = generation;
    void fetchJobArtifactsManifest(jobId, apiPrefix)
      .then((manifestPayload) => {
        if (!pollingPort.isCurrentGeneration(jobId, manifestGeneration)) {
          return;
        }
        secondaryResourcePort.cache("manifest", jobId, manifestPayload);
        renderJobSecondaryPatch?.({
          context: renderContextPort.currentFor(jobId),
          source: "manifest",
        });
      })
      .catch(() => {
        // Artifacts manifest is secondary; keep main status usable even if manifest fails.
      })
      .finally(() => {
        secondaryResourcePort.clearInFlightForCurrentJob("manifest", jobId);
      });
  }

  if (fetchJobStageActions && !secondaryResourcePort.isInFlight("stageActions") && secondaryResourcePort.shouldRefresh("stageActions", JOB_STAGE_ACTIONS_REFRESH_MS, terminal || !cachedStageActions)) {
    secondaryResourcePort.setInFlight("stageActions", true);
    const stageActionsGeneration = generation;
    void fetchJobStageActions(jobId, apiPrefix)
      .then((stageActionsPayload) => {
        if (!pollingPort.isCurrentGeneration(jobId, stageActionsGeneration)) {
          return;
        }
        secondaryResourcePort.cache("stageActions", jobId, stageActionsPayload);
        renderJobSecondaryPatch?.({
          context: renderContextPort.currentFor(jobId),
          source: "stageActions",
        });
      })
      .catch(() => {
        // Stage actions are secondary; keep main status usable even if action discovery fails.
      })
      .finally(() => {
        secondaryResourcePort.clearInFlightForCurrentJob("stageActions", jobId);
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
