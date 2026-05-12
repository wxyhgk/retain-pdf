export function createTimerState() {
  return {
    timer: null,
    elapsedTimer: null,
  };
}

export function createJobState() {
  return {
    currentJobId: "",
    currentJobSnapshot: null,
    currentJobManifest: null,
    currentJobManifestJobId: "",
    currentJobManifestFetchedAt: 0,
    currentJobEvents: null,
    currentJobEventsJobId: "",
    currentJobEventsFetchedAt: 0,
    currentJobDisplayedStageKey: "",
    currentJobStartedAt: "",
    currentJobFinishedAt: "",
  };
}

export function createUploadState() {
  return {
    uploadId: "",
    uploadedFileName: "",
    uploadedPageCount: 0,
    uploadedBytes: 0,
    appliedPageRange: "",
  };
}

export function createRecentJobsState() {
  return {
    recentJobsOffset: 0,
    recentJobsHasMore: true,
    recentJobsDate: "",
    recentJobsItems: [],
  };
}

export function createCredentialState() {
  return {
    validatedOcrProvider: "",
    validatedOcrToken: "",
    ocrValidationStatus: "",
  };
}

export function createDeveloperState() {
  return {
    developerConfig: {},
  };
}

export function createDesktopState() {
  return {
    desktopMode: false,
    desktopConfigured: false,
  };
}

export function createInitialState() {
  return {
    ...createTimerState(),
    ...createJobState(),
    ...createUploadState(),
    ...createRecentJobsState(),
    ...createCredentialState(),
    ...createDeveloperState(),
    ...createDesktopState(),
  };
}

export const state = createInitialState();

export function resetJobState(target = state) {
  Object.assign(target, createJobState());
}

export function resetJobSecondaryState(target = state) {
  Object.assign(target, {
    currentJobManifest: null,
    currentJobManifestJobId: "",
    currentJobManifestFetchedAt: 0,
    currentJobEvents: null,
    currentJobEventsJobId: "",
    currentJobEventsFetchedAt: 0,
    currentJobDisplayedStageKey: "",
  });
}

export function resetUploadState(target = state, { includePageRange = true } = {}) {
  const next = createUploadState();
  if (!includePageRange) {
    delete next.appliedPageRange;
  }
  Object.assign(target, next);
}

export function setUploadState(target = state, {
  uploadId = "",
  uploadedFileName = "",
  uploadedPageCount = 0,
  uploadedBytes = 0,
} = {}) {
  Object.assign(target, {
    uploadId,
    uploadedFileName,
    uploadedPageCount,
    uploadedBytes,
  });
}

export function resetRecentJobsListState(target = state) {
  Object.assign(target, {
    recentJobsOffset: 0,
    recentJobsHasMore: true,
    recentJobsItems: [],
  });
}

export function resetOcrValidationState(target = state) {
  Object.assign(target, createCredentialState());
}
