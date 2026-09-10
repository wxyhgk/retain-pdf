// app-actions（提交任务 / 桌面输出目录）。

import { API_PREFIX } from "@/platform/config/api-constants.js";
import { openDesktopOutputDirectory } from "@/platform/config/desktop-persistence.js";
import {
  createAppActionsRuntimeEnvPort,
  defaultAppActionsConfigPort,
  mountAppActionsFeature,
} from "@/features/ingest/domain.js";
import { syncCurrentJobSnapshot } from "@/features/jobs/index.js";
import {
  buildApiEndpoint,
  submitJobRequest,
} from "@/platform/api/index.js";
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
  /** 常规凭据入口：打开设置 → API，避免与首次配置弹窗双轨 */
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
      setText("error-box", "当前上传文件已失效，请重新上传 PDF 后再提交。");
    },
  };

  // credentials / workflow 在本函数调用前已挂到 features
  const creds = () => features.browserCredentialsFeature;
  const workflow = () => features.workflowFeature;
  const upload = () => features.uploadFeature;
  const jobRuntime = () => features.jobRuntimeFeature;
  const isOcrOnly = () => Boolean((workflow() as any)?.isOcrOnly?.());

  // apiBase 可由 configPort 替代；下层签名仍标成必填。
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
      currentWorkflow: () => (isOcrOnly() ? "ocr" : workflow().currentWorkflow()),
      workflowNeedsCredentials: (w?: string) => workflow().workflowNeedsCredentials(w),
      workflowNeedsUpload: (w?: string) => workflow().workflowNeedsUpload(w),
      currentRenderSourceJobId: () => workflow().currentRenderSourceJobId(),
      currentBudgetState: (w?: string) => {
        if (isOcrOnly()) return { visible: false, blocking: false, tone: "", message: "", topUpUrl: "" } as any;
        return workflow().currentBudgetState(w) as any;
      },
      collectRunPayload: () => workflow().collectRunPayload(),
      validateBeforeSubmit: () => upload().validatePageRanges() ?? true,
      ensureOcrCredentialsReady: (options?: unknown) => creds().ensureOcrCredentialsReady(options),
      hasBrowserCredentials: () => {
        if (isOcrOnly()) return creds().hasOcrCredentials();
        return Boolean(creds().hasBrowserCredentials());
      },
      openBrowserCredentialsDialog: (options?: unknown) => {
        const opts = (options && typeof options === "object" ? options : {}) as { setupMode?: boolean };
        if (opts.setupMode) {
          creds().openBrowserCredentialsDialog({ setupMode: true });
          return;
        }
        // 常规缺 Key：设置 → API（与 UI 事件路由一致）
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
