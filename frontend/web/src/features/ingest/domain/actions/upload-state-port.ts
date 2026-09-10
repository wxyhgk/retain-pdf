function readUploadState(targetState: any = {}) {
  return {
    uploadId: targetState.uploadId,
    uploadedFileName: targetState.uploadedFileName,
    uploadedPageCount: targetState.uploadedPageCount,
    uploadedBytes: targetState.uploadedBytes,
    appliedPageRange: targetState.appliedPageRange,
    submitBusy: targetState.submitBusy,
  };
}

function resetUploadState(targetState: any = {}, { includePageRange = true }: any = {}) {
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

const defaultUploadStateAdapter = Object.freeze({
  getSnapshot: readUploadState,
  reset: resetUploadState,
});

function syncSubmitBusy(targetState, busy) {
  if (targetState) {
    targetState.submitBusy = !!busy;
  }
}

export function createAppActionsUploadStatePort(
  targetState: any = {},
  adapter = defaultUploadStateAdapter,
) {
  return Object.freeze({
    getSnapshot: () => adapter.getSnapshot(targetState),
    reset: (options = {}) => adapter.reset(targetState, options),
    setSubmitBusy: (busy = false) => {
      syncSubmitBusy(targetState, busy);
      return adapter.getSnapshot(targetState);
    },
  });
}
