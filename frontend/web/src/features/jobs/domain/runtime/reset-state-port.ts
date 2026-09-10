import type { JobLike, JobPayload, ManifestPayload } from "@retainpdf/domain/job";

/**
 * Host-state fields mutated by job-runtime reset helpers
 * (upload slice + current-job / secondary-resource flat fields).
 */
export interface JobRuntimeResetTarget {
  // upload
  uploadId?: string;
  uploadedFileName?: string;
  uploadedPageCount?: number;
  uploadedBytes?: number;
  submitBusy?: boolean;
  appliedPageRange?: string;
  // job primary
  currentJobId?: string;
  currentJobSnapshot?: JobLike | JobPayload | null;
  currentJobPollGeneration?: number;
  currentJobPollInFlight?: boolean;
  currentJobDisplayedStageKey?: string;
  currentJobDisplayedStageJobId?: string;
  currentJobStartedAt?: string;
  currentJobFinishedAt?: string;
  // secondary resources (flat mirror)
  currentJobManifest?: ManifestPayload | null;
  currentJobManifestJobId?: string;
  currentJobManifestFetchedAt?: number;
  currentJobManifestFetchInFlight?: boolean;
  currentJobEvents?: unknown;
  currentJobEventsJobId?: string;
  currentJobEventsFetchedAt?: number;
  currentJobEventsFetchInFlight?: boolean;
  currentJobStageActions?: unknown;
  currentJobStageActionsJobId?: string;
  currentJobStageActionsFetchedAt?: number;
  currentJobStageActionsFetchInFlight?: boolean;
  [key: string]: unknown;
}

export interface ResetUploadStateOptions {
  includePageRange?: boolean;
}

export interface JobRuntimeResetStateAdapter {
  clearAppliedPageRange: (targetState: JobRuntimeResetTarget) => void;
  resetJobSecondaryState: (targetState: JobRuntimeResetTarget) => void;
  resetJobState: (targetState: JobRuntimeResetTarget) => void;
  resetUploadState: (
    targetState: JobRuntimeResetTarget,
    options?: ResetUploadStateOptions,
  ) => void;
}

export interface JobRuntimeResetStatePort {
  clearAppliedPageRange: () => void;
  resetJob: () => void;
  resetSecondary: () => void;
  resetUpload: (options?: ResetUploadStateOptions) => void;
}

function defaultResetUploadState(
  targetState: JobRuntimeResetTarget = {},
  { includePageRange = true }: ResetUploadStateOptions = {},
) {
  Object.assign(targetState, {
    uploadId: "",
    uploadedFileName: "",
    uploadedPageCount: 0,
    uploadedBytes: 0,
    submitBusy: false,
  });
  if (includePageRange) {
    targetState.appliedPageRange = "";
  }
}

function defaultClearAppliedPageRange(targetState: JobRuntimeResetTarget = {}) {
  targetState.appliedPageRange = "";
}

function defaultResetJobState(targetState: JobRuntimeResetTarget = {}) {
  Object.assign(targetState, {
    currentJobId: "",
    currentJobSnapshot: null,
    currentJobManifest: null,
    currentJobManifestJobId: "",
    currentJobManifestFetchedAt: 0,
    currentJobEvents: null,
    currentJobEventsJobId: "",
    currentJobEventsFetchedAt: 0,
    currentJobStageActions: null,
    currentJobStageActionsJobId: "",
    currentJobStageActionsFetchedAt: 0,
    currentJobPollGeneration: 0,
    currentJobPollInFlight: false,
    currentJobEventsFetchInFlight: false,
    currentJobManifestFetchInFlight: false,
    currentJobStageActionsFetchInFlight: false,
    currentJobDisplayedStageKey: "",
    currentJobDisplayedStageJobId: "",
    currentJobStartedAt: "",
    currentJobFinishedAt: "",
  });
}

function defaultResetJobSecondaryState(targetState: JobRuntimeResetTarget = {}) {
  Object.assign(targetState, {
    currentJobManifest: null,
    currentJobManifestJobId: "",
    currentJobManifestFetchedAt: 0,
    currentJobEvents: null,
    currentJobEventsJobId: "",
    currentJobEventsFetchedAt: 0,
    currentJobStageActions: null,
    currentJobStageActionsJobId: "",
    currentJobStageActionsFetchedAt: 0,
    currentJobPollInFlight: false,
    currentJobEventsFetchInFlight: false,
    currentJobManifestFetchInFlight: false,
    currentJobStageActionsFetchInFlight: false,
    currentJobDisplayedStageKey: "",
    currentJobDisplayedStageJobId: "",
  });
}

const defaultResetStateAdapter: JobRuntimeResetStateAdapter = Object.freeze({
  clearAppliedPageRange: defaultClearAppliedPageRange,
  resetJobSecondaryState: defaultResetJobSecondaryState,
  resetJobState: defaultResetJobState,
  resetUploadState: defaultResetUploadState,
});

export function createJobRuntimeResetStatePort(
  targetState: JobRuntimeResetTarget,
  adapter: JobRuntimeResetStateAdapter = defaultResetStateAdapter,
): JobRuntimeResetStatePort {
  function resetUpload(options: ResetUploadStateOptions = {}) {
    adapter.resetUploadState(targetState, options);
    adapter.clearAppliedPageRange(targetState);
  }

  return Object.freeze({
    clearAppliedPageRange: () => adapter.clearAppliedPageRange(targetState),
    resetJob: () => adapter.resetJobState(targetState),
    resetSecondary: () => adapter.resetJobSecondaryState(targetState),
    resetUpload,
  });
}
