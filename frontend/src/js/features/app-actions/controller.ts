import {
  runSubmitFlow,
  type AppActionsConfigPort,
  type BudgetStateSnapshot,
  type LibraryEventPortLike,
  type OcrCredentialCheckResult,
  type SetTextFn,
} from "./submit-flow.js";
import { defaultAppActionsConfigPort } from "./config-port.js";
import { createAppActionsViewPort } from "./action-view-port.js";
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
  isDesktopMode?: () => boolean;
  isDesktopConfigured?: () => boolean;
}

export interface AppActionsJobSnapshotPort {
  syncCurrentJobSnapshot?: (
    payload?: unknown,
    jobId?: unknown,
    meta?: { startedAt?: string; finishedAt?: string },
  ) => void;
}

export interface AppActionsViewPort {
  setSubmitBusyState?: (busy?: boolean) => void;
  resetMissingUpload?: (options?: {
    state?: unknown;
    uploadStatePort?: AppActionsUploadStatePort;
    resetUploadedFile?: () => void;
    setText?: SetTextFn;
  }) => void;
}

export interface SubmitFlowDeps {
  openSetupDialog?: () => void;
  renderJob?: (payload?: unknown) => void;
  submitJobRequest?: (apiPrefix?: unknown, payload?: unknown) => Promise<unknown> | unknown;
  currentWorkflow?: () => string;
  workflowNeedsCredentials?: (workflow?: string) => boolean | unknown;
  workflowNeedsUpload?: (workflow?: string) => boolean | unknown;
  currentRenderSourceJobId?: () => string | unknown;
  currentBudgetState?: (workflow?: string) => BudgetStateSnapshot | null | undefined | unknown;
  collectRunPayload?: () => unknown;
  validateBeforeSubmit?: () => boolean | unknown;
  ensureOcrCredentialsReady?: (options?: {
    onMissingToken?: () => void;
    onInvalidToken?: (result?: OcrCredentialCheckResult) => void;
  } | unknown) => Promise<boolean | unknown> | boolean | unknown;
  hasBrowserCredentials?: () => boolean | unknown;
  openBrowserCredentialsDialog?: (options?: unknown) => void;
  refreshDeepSeekBalance?: (options?: {
    silent?: boolean;
  } | unknown) => Promise<unknown> | unknown;
  startJobPolling?: (jobId?: string) => void;
  libraryEventPort?: LibraryEventPortLike;
  jobSnapshotPort?: AppActionsJobSnapshotPort;
}

export interface MountAppActionsFeatureOptions {
  state?: unknown;
  uploadStatePort?: AppActionsUploadStatePort;
  runtimeEnvPort?: AppActionsRuntimeEnvPort;
  jobSnapshotPort?: AppActionsJobSnapshotPort;
  viewPort?: AppActionsViewPort;
  apiBase?: string | (() => string);
  apiPrefix?: string;
  buildApiEndpoint?: (prefix?: string, path?: string) => string;
  setText?: SetTextFn;
  openDesktopOutputDirectory?: () => Promise<unknown> | unknown;
  resetUploadedFile?: () => void;
  submitFlow?: SubmitFlowDeps;
  openSetupDialog?: () => void;
  renderJob?: (payload?: unknown) => void;
  submitJobRequest?: (apiPrefix?: unknown, payload?: unknown) => Promise<unknown> | unknown;
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
  startJobPolling?: (jobId?: string) => void;
  libraryEventPort?: LibraryEventPortLike;
  configPort?: AppActionsConfigPort;
}

export function mountAppActionsFeature({
  state,
  uploadStatePort,
  runtimeEnvPort,
  jobSnapshotPort,
  viewPort = createAppActionsViewPort(),
  apiBase,
  apiPrefix,
  buildApiEndpoint,
  setText,
  openDesktopOutputDirectory,
  resetUploadedFile,
  submitFlow,
  openSetupDialog = submitFlow?.openSetupDialog,
  renderJob = submitFlow?.renderJob,
  submitJobRequest = submitFlow?.submitJobRequest,
  currentWorkflow = submitFlow?.currentWorkflow,
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

  function setSubmitBusyState(busy) {
    uploadState.setSubmitBusy?.(busy);
    viewPort.setSubmitBusyState(busy);
  }

  function isMissingUploadError(error) {
    const message = `${error?.message || error || ""}`;
    return message.includes("upload not found");
  }

  function handleMissingUploadError() {
    viewPort.resetMissingUpload({ state, uploadStatePort: uploadState, resetUploadedFile, setText });
  }

  async function submitForm(event) {
    event.preventDefault();
    const workflow = currentWorkflow();
    const desktopMode = runtimeEnv.isDesktopMode();
    setSubmitBusyState(true);
    try {
      const uploadSnapshot = readUploadState();
      await runSubmitFlow({
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
      const message = `Frontend hiện không kết nối được backend. API Base: ${label}. Hãy kiểm tra dịch vụ cục bộ đã khởi động rồi thử lại.`;
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
