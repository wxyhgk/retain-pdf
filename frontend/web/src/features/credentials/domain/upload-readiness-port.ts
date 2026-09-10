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

const defaultUploadReadinessAdapter = Object.freeze({
  getSnapshot: readUploadState,
});

export function createCredentialUploadReadinessPort(
  targetState: any = {},
  adapter = defaultUploadReadinessAdapter,
) {
  return Object.freeze({
    getSnapshot: () => adapter.getSnapshot(targetState),
  });
}
