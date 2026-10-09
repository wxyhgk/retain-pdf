/** 上传态的可读写快照（由 app 状态对象提供，字段与 reset 写入的一致）。 */
export interface UploadStateLike {
  uploadId?: string;
  uploadedFileName?: string;
  uploadedPageCount?: number;
  uploadedBytes?: number;
  appliedPageRange?: string;
  submitBusy?: boolean;
}

export interface UploadStateResetOptions {
  includePageRange?: boolean;
}

function readUploadState(targetState: UploadStateLike = {}) {
  return {
    uploadId: targetState.uploadId,
    uploadedFileName: targetState.uploadedFileName,
    uploadedPageCount: targetState.uploadedPageCount,
    uploadedBytes: targetState.uploadedBytes,
    appliedPageRange: targetState.appliedPageRange,
    submitBusy: targetState.submitBusy,
  };
}

function resetUploadState(targetState: UploadStateLike = {}, { includePageRange = true }: UploadStateResetOptions = {}) {
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

function syncSubmitBusy(targetState: UploadStateLike | null | undefined, busy: boolean) {
  if (targetState) {
    targetState.submitBusy = !!busy;
  }
}

export function createAppActionsUploadStatePort(
  targetState: UploadStateLike = {},
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
