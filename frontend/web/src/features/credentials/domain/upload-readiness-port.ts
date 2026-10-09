// 上传态的只读切片：本功能只读这几个字段，不依赖 ingest 的完整 UploadState 类型。
export interface UploadReadinessSource {
  uploadId?: string;
  uploadedFileName?: string;
  uploadedPageCount?: number;
  uploadedBytes?: number;
  appliedPageRange?: string;
  submitBusy?: boolean;
}

function readUploadState(targetState: UploadReadinessSource = {}) {
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
  targetState: UploadReadinessSource = {},
  adapter = defaultUploadReadinessAdapter,
) {
  return Object.freeze({
    getSnapshot: () => adapter.getSnapshot(targetState),
  });
}
