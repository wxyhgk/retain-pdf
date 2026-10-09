import {
  runSubmitFlow,
  type AppActionsConfigPort,
  type BudgetStateSnapshot,
  type LibraryEventPortLike,
  type OcrCredentialCheckResult,
  type SetTextFn,
} from "./submit-flow.js";
import { defaultAppActionsConfigPort } from "./config-port.js";
import { createAppActionsRuntimeEnvPort } from "./runtime-env-port.js";
import { createAppActionsJobSnapshotPort } from "./job-snapshot-port.js";
import { createAppActionsUploadStatePort } from "./upload-state-port.js";

export interface AppActionsUploadStatePort {
  getSnapshot?: () => {
    uploadId?: string;
  };
  reset?: (options?: { includePageRange?: boolean }) => void;
  setSubmitBusy?: (busy?: boolean) => void;
}

export interface AppActionsRuntimeEnvPort {
  isDesktopMode: () => boolean;
  isDesktopConfigured: () => boolean;
}

export interface AppActionsJobSnapshotPort {
  syncCurrentJobSnapshot: (
    payload?: unknown,
    jobId?: unknown,
    meta?: { startedAt?: string; finishedAt?: string },
  ) => void;
}

export interface AppActionsViewPort {
  setSubmitBusyState: (busy: boolean) => void;
  resetMissingUpload: (options?: {
    state?: unknown;
    uploadStatePort?: AppActionsUploadStatePort;
    resetUploadedFile?: () => void;
    setText?: SetTextFn;
  }) => void;
}

export interface SubmitFlowDeps {
  openSetupDialog?: () => void;
  renderJob?: (payload?: unknown) => void;
  submitJobRequest: (apiPrefix: string, payload: unknown) => Promise<unknown> | unknown;
  currentWorkflow: () => string;
  workflowNeedsCredentials?: (workflow?: string) => boolean | unknown;
  workflowNeedsUpload?: (workflow?: string) => boolean | unknown;
  currentRenderSourceJobId?: () => string | unknown;
  currentBudgetState?: (workflow?: string) => BudgetStateSnapshot | null | undefined | unknown;
  collectRunPayload?: () => unknown;
  validateBeforeSubmit?: () => boolean | unknown;
  ensureOcrCredentialsReady?: (options?: {
    onMissingToken?: () => void;
    onInvalidToken?: (result?: OcrCredentialCheckResult | null) => void;
  }) => Promise<boolean | unknown> | boolean | unknown;
  hasBrowserCredentials?: () => boolean | unknown;
  openBrowserCredentialsDialog?: (options?: unknown) => void;
  refreshDeepSeekBalance?: (options?: {
    silent?: boolean;
  }) => Promise<unknown> | unknown;
  /** provider 预检失败的告知口（预检已改为后台并行，不再挡提交）。 */
  notifyPreflightWarning?: (message: string) => void;
  startJobPolling?: (jobId: string) => void;
  libraryEventPort?: LibraryEventPortLike;
  jobSnapshotPort?: AppActionsJobSnapshotPort;
}

export interface MountAppActionsFeatureOptions {
  state?: unknown;
  uploadStatePort?: AppActionsUploadStatePort;
  runtimeEnvPort?: AppActionsRuntimeEnvPort;
  jobSnapshotPort?: AppActionsJobSnapshotPort;
  viewPort: AppActionsViewPort;
  apiBase?: string | (() => string);
  apiPrefix: string;
  buildApiEndpoint: (prefix?: string, path?: string) => string;
  setText: SetTextFn;
  openDesktopOutputDirectory: () => Promise<unknown> | unknown;
  resetUploadedFile?: () => void;
  /** 提交流程依赖；组装层（create-app-actions）总是整包传入。下面同名的单项可覆盖。 */
  submitFlow: SubmitFlowDeps;
  openSetupDialog?: () => void;
  renderJob?: (payload?: unknown) => void;
  submitJobRequest?: (apiPrefix: string, payload: unknown) => Promise<unknown> | unknown;
  currentWorkflow?: () => string;
  workflowNeedsCredentials?: (workflow?: string) => boolean | unknown;
  workflowNeedsUpload?: (workflow?: string) => boolean | unknown;
  currentRenderSourceJobId?: () => string | unknown;
  currentBudgetState?: (workflow?: string) => BudgetStateSnapshot | null | undefined | unknown;
  collectRunPayload?: () => unknown;
  validateBeforeSubmit?: () => boolean | unknown;
  ensureOcrCredentialsReady?: SubmitFlowDeps["ensureOcrCredentialsReady"];
  hasBrowserCredentials?: () => boolean | unknown;
  openBrowserCredentialsDialog?: (options?: unknown) => void;
  refreshDeepSeekBalance?: SubmitFlowDeps["refreshDeepSeekBalance"];
  notifyPreflightWarning?: SubmitFlowDeps["notifyPreflightWarning"];
  startJobPolling?: (jobId: string) => void;
  libraryEventPort?: LibraryEventPortLike;
  configPort?: AppActionsConfigPort;
}

export function mountAppActionsFeature({
  state,
  uploadStatePort,
  runtimeEnvPort,
  jobSnapshotPort,
  viewPort,
  apiBase,
  apiPrefix,
  buildApiEndpoint,
  setText,
  openDesktopOutputDirectory,
  resetUploadedFile,
  submitFlow,
  openSetupDialog = submitFlow?.openSetupDialog,
  renderJob = submitFlow?.renderJob,
  submitJobRequest = submitFlow.submitJobRequest,
  currentWorkflow = submitFlow.currentWorkflow,
  workflowNeedsCredentials = submitFlow?.workflowNeedsCredentials,
  workflowNeedsUpload = submitFlow?.workflowNeedsUpload,
  currentRenderSourceJobId = submitFlow?.currentRenderSourceJobId,
  currentBudgetState = submitFlow?.currentBudgetState,
  collectRunPayload = submitFlow?.collectRunPayload,
  validateBeforeSubmit = submitFlow?.validateBeforeSubmit,
  ensureOcrCredentialsReady = submitFlow?.ensureOcrCredentialsReady,
  hasBrowserCredentials = submitFlow?.hasBrowserCredentials,
  openBrowserCredentialsDialog = submitFlow?.openBrowserCredentialsDialog,
  refreshDeepSeekBalance = submitFlow?.refreshDeepSeekBalance,
  notifyPreflightWarning = submitFlow?.notifyPreflightWarning,
  startJobPolling = submitFlow?.startJobPolling,
  libraryEventPort = submitFlow?.libraryEventPort,
  jobSnapshotPort: submitFlowJobSnapshotPort = submitFlow?.jobSnapshotPort,
  configPort = apiBase
    ? {
      apiBaseLabel: apiBase,
      isMock: defaultAppActionsConfigPort.isMock,
    }
    : defaultAppActionsConfigPort,
}: MountAppActionsFeatureOptions) {
  const uploadState = uploadStatePort || createAppActionsUploadStatePort(state);
  const runtimeEnv = runtimeEnvPort || createAppActionsRuntimeEnvPort(state);
  const jobSnapshot = jobSnapshotPort || submitFlowJobSnapshotPort || createAppActionsJobSnapshotPort(state);

  function readUploadState() {
    return uploadState.getSnapshot?.() || {};
  }

  function setSubmitBusyState(busy: boolean) {
    uploadState.setSubmitBusy?.(busy);
    viewPort.setSubmitBusyState(busy);
  }

  function isMissingUploadError(error: unknown) {
    const message = `${(error as { message?: string } | null | undefined)?.message || error || ""}`;
    return message.includes("upload not found");
  }

  function handleMissingUploadError() {
    viewPort.resetMissingUpload({ state, uploadStatePort: uploadState, resetUploadedFile, setText });
  }

  async function submitForm(event: Pick<Event, "preventDefault">) {
    event.preventDefault();
    const workflow = currentWorkflow();
    const desktopMode = runtimeEnv.isDesktopMode();
    setSubmitBusyState(true);
    try {
      const uploadSnapshot = readUploadState();
      return await runSubmitFlow({
        workflow,
        desktopMode,
        configPort,
        state,
        apiPrefix,
        uploadId: uploadSnapshot.uploadId,
        desktopConfigured: runtimeEnv.isDesktopConfigured(),
        openSetupDialog,
        openBrowserCredentialsDialog,
        setText,
        submitJobRequest,
        workflowNeedsUpload,
        workflowNeedsCredentials,
        currentRenderSourceJobId,
        currentBudgetState,
        collectRunPayload,
        validateBeforeSubmit,
        ensureOcrCredentialsReady,
        hasBrowserCredentials,
        refreshDeepSeekBalance,
        notifyPreflightWarning,
        syncCurrentJobSnapshot: (_state, payload, jobId, meta) => {
          jobSnapshot.syncCurrentJobSnapshot(payload, jobId, meta);
        },
        renderJob,
        startJobPolling,
        libraryEventPort,
        isMissingUploadError,
        handleMissingUploadError,
      });
    } finally {
      setSubmitBusyState(false);
    }
  }

  async function checkApiConnectivity() {
    try {
      const resp = await fetch(buildApiEndpoint("", "health"));
      if (!resp.ok) {
        throw new Error(`health ${resp.status}`);
      }
      return true;
    } catch (_err) {
      const label = typeof configPort.apiBaseLabel === "function"
        ? configPort.apiBaseLabel()
        : configPort.apiBaseLabel;
      const message = `当前前端无法连接后端。API Base: ${label}。请确认本地服务已经启动，然后重试。`;
      setText("error-box", message);
      throw new Error(message);
    }
  }

  async function handleOpenOutputDir() {
    try {
      await openDesktopOutputDirectory();
    } catch (err) {
      setText("error-box", (err as { message?: string })?.message || String(err));
    }
  }

  return {
    checkApiConnectivity,
    handleOpenOutputDir,
    submitForm,
  };
}
