// app-actions（Gửi nhiệm vụ / Thư mục đầu ra máy tính để bàn）。

import {
  API_PREFIX,
  openDesktopOutputDirectory,
  mountAppActionsFeature,
  defaultAppActionsConfigPort,
  createAppActionsRuntimeEnvPort,
  submitJobRequest,
  syncCurrentJobSnapshot,
  buildApiEndpoint,
} from "./external.js";
import type {
  AppActionsFeature,
  HomeBridge,
  HomeFeatures,
  UploadStatePort,
} from "./types.js";

type WorkflowViewPort = {
  setSubmitBusy: (busy: boolean) => void;
  setSubmitDisabled: (disabled: boolean) => void;
};

type UploadViewPort = {
  resetUploadedFileView: () => void;
};

type StatusCardPresenterPort = {
  renderMain: () => void;
};

type LibraryEventPort = {
  requestRefresh?: (opts?: unknown) => void;
};

type SettingsHubDialogStore = {
  open: (payload?: { tab?: string } | null) => void;
};

type CreateAppActionsArgs = {
  features: HomeFeatures;
  bridge: Pick<HomeBridge, "resetUploadedFile">;
  setText: (id: string, value?: string) => void;
  workflowView: WorkflowViewPort;
  uploadView: UploadViewPort;
  uploadStatePort: UploadStatePort;
  legacyState: Record<string, unknown>;
  jobRuntimeState: Record<string, unknown>;
  statusCardPresenter: StatusCardPresenterPort;
  libraryEventPort: LibraryEventPort;
  /** Cổng thông tin xác thực chung：Mở cài đặt → API，Tránh các bài hát đôi với cửa sổ bật lên được định cấu hình lần đầu tiên */
  settingsHubDialogStore?: SettingsHubDialogStore | null;
};

export function createAppActions({
  features,
  bridge,
  setText,
  workflowView,
  uploadView,
  uploadStatePort,
  legacyState,
  jobRuntimeState,
  statusCardPresenter,
  libraryEventPort,
  settingsHubDialogStore = null,
}: CreateAppActionsArgs): { appActionsFeature: AppActionsFeature } {
  const jobSnapshotPort = Object.freeze({
    syncCurrentJobSnapshot: (
      payload: unknown,
      jobId: unknown,
      meta?: { startedAt?: string; finishedAt?: string },
    ) => (
      syncCurrentJobSnapshot(jobRuntimeState, payload, jobId, meta)
    ),
  });

  const viewPort = {
    setSubmitBusyState: (busy: boolean) => workflowView.setSubmitBusy(busy),
    resetMissingUpload: () => {
      uploadStatePort.reset({ includePageRange: false });
      workflowView.setSubmitDisabled(true);
      uploadView.resetUploadedFileView();
      setText("error-box", "Tệp đã tải lên không còn hợp lệ, hãy tải lại PDF rồi gửi lại.");
    },
  };

  // credentials / workflow đã bị treo trước khi chức năng này gọi đến features
  const creds = () => features.browserCredentialsFeature;
  const workflow = () => features.workflowFeature;
  const upload = () => features.uploadFeature;
  const jobRuntime = () => features.jobRuntimeFeature;

  // apiBase Có sẵn từ configPort Thay thế；Chữ ký cơ bản vẫn được đánh dấu là bắt buộc。
  const appActionsFeature = mountAppActionsFeature({
    state: jobRuntimeState,
    uploadStatePort,
    runtimeEnvPort: createAppActionsRuntimeEnvPort(legacyState),
    jobSnapshotPort,
    viewPort,
    configPort: defaultAppActionsConfigPort,
    apiPrefix: API_PREFIX,
    buildApiEndpoint,
    setText,
    openDesktopOutputDirectory,
    resetUploadedFile: bridge.resetUploadedFile,
    submitFlow: {
      openSetupDialog: () => creds().openBrowserCredentialsDialog({ setupMode: true }),
      renderJob: statusCardPresenter.renderMain,
      submitJobRequest,
      currentWorkflow: () => workflow().currentWorkflow(),
      workflowNeedsCredentials: (w?: string) => workflow().workflowNeedsCredentials(w),
      workflowNeedsUpload: (w?: string) => workflow().workflowNeedsUpload(w),
      currentRenderSourceJobId: () => workflow().currentRenderSourceJobId(),
      currentBudgetState: (w?: string) => workflow().currentBudgetState(w),
      collectRunPayload: () => workflow().collectRunPayload(),
      validateBeforeSubmit: () => upload().validatePageRanges() ?? true,
      ensureOcrCredentialsReady: (options?: unknown) => creds().ensureOcrCredentialsReady(options),
      hasBrowserCredentials: () => Boolean(creds().hasBrowserCredentials()),
      openBrowserCredentialsDialog: (options?: unknown) => {
        const opts = (options && typeof options === "object" ? options : {}) as { setupMode?: boolean };
        if (opts.setupMode) {
          creds().openBrowserCredentialsDialog({ setupMode: true });
          return;
        }
        // Thiếu chung Key：Thiết lập → API（VÀ UI Định tuyến sự kiện nhất quán）
        if (settingsHubDialogStore?.open) {
          settingsHubDialogStore.open({ tab: "api" });
          return;
        }
        creds().openBrowserCredentialsDialog(opts);
      },
      refreshDeepSeekBalance: (options?: unknown) => creds().refreshDeepSeekBalance(options),
      startJobPolling: (jobId: string) => jobRuntime().startPolling(jobId),
      libraryEventPort,
      jobSnapshotPort,
    },
  }) as AppActionsFeature;

  return { appActionsFeature };
}
