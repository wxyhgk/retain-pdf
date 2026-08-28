import { withTimeout } from "../../utils/async-timeout.js";
import { buildErrorDiagnostic } from "../../utils/error-diagnostics.js";
import {
  resolveSubmitReadiness,
  SUBMIT_BLOCK_REASONS,
} from "../../contracts/submit-readiness-contract.js";
import { APP_EVENTS } from "../../contracts/app-contract.js";

export const DEEPSEEK_BALANCE_CHECK_TIMEOUT_MS = 12000;

/** DeepSeek balance/budget snapshot from the workflow budget side. */
export interface BudgetStateSnapshot {
  visible?: boolean;
  blocking?: boolean;
  balanceChecked?: boolean;
  message?: string;
}

export interface AppActionsConfigPort {
  isMock?: () => boolean;
  apiBaseLabel?: (() => string) | string;
}

export interface SubmitReadinessSnapshot {
  ready?: boolean;
  reason?: string;
}

export interface JobPayload {
  job_id?: string;
}

export interface DeepSeekBalanceCheckResult {
  status?: string;
  ok?: boolean;
}

export interface OcrCredentialCheckResult {
  summary?: string;
  ok?: boolean;
  status?: string;
}

export interface LibraryEventPortLike {
  publishJobCreated?: (job?: unknown) => void;
  requestRefresh?: (options?: { delay?: number; force?: boolean }) => void;
}

export interface DocumentRefLike {
  defaultView?: { CustomEvent?: typeof CustomEvent } | null;
  dispatchEvent?: (event: Event | { type: string }) => boolean;
}

export interface WindowRefLike {
  setTimeout?: (handler: TimerHandler, timeout?: number, ...args: unknown[]) => number;
}

/** setText accepts a string or diagnostic object; error-box formatting happens later. */
export type SetTextFn = (id: string, text?: unknown) => void;

export interface NeedsDeepSeekBudgetCheckOptions {
  workflow?: string;
  workflowNeedsUpload?: (workflow?: string) => boolean | unknown;
  currentBudgetState?: (workflow?: string) => BudgetStateSnapshot | null | undefined | unknown;
}

export interface EnsureDeepSeekBudgetReadyOptions extends NeedsDeepSeekBudgetCheckOptions {
  refreshDeepSeekBalance?: (options?: {
    silent?: boolean;
  }) => Promise<DeepSeekBalanceCheckResult | null | undefined | unknown> | DeepSeekBalanceCheckResult | null | undefined | unknown;
  setText?: SetTextFn;
  timeoutMs?: number;
}

export interface CurrentSubmitReadinessOptions {
  workflow?: string;
  configPort?: AppActionsConfigPort;
  desktopMode?: boolean;
  desktopConfigured?: boolean;
  uploadId?: string;
  currentRenderSourceJobId?: () => string | unknown;
  hasBrowserCredentials?: () => boolean | unknown;
  workflowNeedsUpload?: (workflow?: string) => boolean | unknown;
  workflowNeedsCredentials?: (workflow?: string) => boolean | unknown;
  currentBudgetState?: (workflow?: string) => BudgetStateSnapshot | null | undefined | unknown;
}

export interface HandleSubmitReadinessBlockOptions {
  readiness?: SubmitReadinessSnapshot | null;
  openSetupDialog?: () => void;
  openBrowserCredentialsDialog?: (options?: unknown) => void;
  currentBudgetState?: (workflow?: string) => BudgetStateSnapshot | null | undefined | unknown;
  setText?: SetTextFn;
}

export interface EnsureOcrCredentialsForSubmitOptions {
  workflow?: string;
  desktopMode?: boolean;
  workflowNeedsCredentials?: (workflow?: string) => boolean | unknown;
  ensureOcrCredentialsReady?: (options?: {
    onMissingToken?: () => void;
    onInvalidToken?: (result?: OcrCredentialCheckResult) => void;
  }) => Promise<boolean | unknown> | boolean | unknown;
  openBrowserCredentialsDialog?: (options?: unknown) => void;
  setText?: SetTextFn;
}

export interface PublishSubmitSuccessOptions {
  payload?: JobPayload | null | unknown;
  state?: unknown;
  renderJob?: (payload?: unknown) => void;
  syncCurrentJobSnapshot?: (
    state: unknown,
    payload: unknown,
    jobId: string,
    meta?: { startedAt?: string },
  ) => void;
  startJobPolling?: (jobId?: string) => void;
  libraryEventPort?: LibraryEventPortLike;
  documentRef?: DocumentRefLike | Document | null;
  windowRef?: WindowRefLike | Window | null;
  now?: () => string;
}

export interface RunSubmitFlowOptions {
  workflow?: string;
  desktopMode?: boolean;
  configPort?: AppActionsConfigPort;
  state?: unknown;
  apiPrefix?: string;
  uploadId?: string;
  desktopConfigured?: boolean;
  openSetupDialog?: () => void;
  openBrowserCredentialsDialog?: (options?: unknown) => void;
  setText?: SetTextFn;
  submitJobRequest?: (apiPrefix?: unknown, payload?: unknown) => Promise<unknown> | unknown;
  workflowNeedsUpload?: (workflow?: string) => boolean | unknown;
  workflowNeedsCredentials?: (workflow?: string) => boolean | unknown;
  currentRenderSourceJobId?: () => string | unknown;
  currentBudgetState?: (workflow?: string) => BudgetStateSnapshot | null | undefined | unknown;
  collectRunPayload?: () => unknown;
  validateBeforeSubmit?: () => boolean | unknown;
  ensureOcrCredentialsReady?: EnsureOcrCredentialsForSubmitOptions["ensureOcrCredentialsReady"];
  hasBrowserCredentials?: () => boolean | unknown;
  refreshDeepSeekBalance?: EnsureDeepSeekBudgetReadyOptions["refreshDeepSeekBalance"];
  syncCurrentJobSnapshot?: PublishSubmitSuccessOptions["syncCurrentJobSnapshot"];
  renderJob?: (payload?: unknown) => void;
  startJobPolling?: (jobId?: string) => void;
  libraryEventPort?: LibraryEventPortLike;
  isMissingUploadError?: (error: unknown) => boolean;
  handleMissingUploadError?: () => void;
  documentRef?: DocumentRefLike | Document | null;
  windowRef?: WindowRefLike | Window | null;
  now?: () => string;
}

function asBudgetState(value: unknown): BudgetStateSnapshot | null | undefined {
  if (value == null || typeof value !== "object") {
    return value as null | undefined;
  }
  return value as BudgetStateSnapshot;
}

function asJobPayload(value: unknown): JobPayload | null | undefined {
  if (value == null || typeof value !== "object") {
    return value as null | undefined;
  }
  return value as JobPayload;
}

function asBalanceResult(value: unknown): DeepSeekBalanceCheckResult | null | undefined {
  if (value == null || typeof value !== "object") {
    return value as null | undefined;
  }
  return value as DeepSeekBalanceCheckResult;
}

export function needsDeepSeekBudgetCheck({
  workflow,
  workflowNeedsUpload,
  currentBudgetState,
}: NeedsDeepSeekBudgetCheckOptions = {}) {
  const budget = asBudgetState(currentBudgetState?.());
  return Boolean(workflowNeedsUpload?.(workflow)) && Boolean(budget?.visible);
}

export async function ensureDeepSeekBudgetReady({
  workflow,
  workflowNeedsUpload,
  currentBudgetState,
  refreshDeepSeekBalance,
  setText,
  timeoutMs = DEEPSEEK_BALANCE_CHECK_TIMEOUT_MS,
}: EnsureDeepSeekBudgetReadyOptions = {}) {
  if (!needsDeepSeekBudgetCheck({ workflow, workflowNeedsUpload, currentBudgetState })) {
    return true;
  }
  setText("error-box", "Đang kiểm tra số dư DeepSeek...");
  try {
    const result = asBalanceResult(await withTimeout(
      refreshDeepSeekBalance?.({ silent: true }) || Promise.resolve(null),
      timeoutMs,
      "Kiểm tra số dư DeepSeek đã hết thời gian chờ. Hãy thử lại sau hoặc kiểm tra trong cài đặt API.",
    ));
    if (result?.status === "missing_key") {
      setText("error-box", "Hãy nhập DeepSeek API Key trước.");
      return false;
    }
    if (result?.status === "network_error") {
      setText("error-box", "Không kiểm tra được số dư DeepSeek. Hãy thử lại sau hoặc kiểm tra trong cài đặt API.");
      return false;
    }
  } catch (error) {
    setText("error-box", (error as { message?: string })?.message || "Không kiểm tra được số dư DeepSeek. Hãy thử lại sau.");
    return false;
  }
  const budget = asBudgetState(currentBudgetState?.());
  if (budget?.blocking) {
    setText("error-box", `Số dư không đủ: ${budget.message}. Hãy nạp thêm rồi gửi lại.`);
    return false;
  }
  if (budget?.visible && !budget.balanceChecked) {
    setText("error-box", "Chưa xác nhận được số dư DeepSeek. Hãy kiểm tra trong cài đặt API trước.");
    return false;
  }
  return true;
}

export function currentSubmitReadiness({
  workflow,
  configPort,
  desktopMode,
  desktopConfigured,
  uploadId,
  currentRenderSourceJobId,
  hasBrowserCredentials,
  workflowNeedsUpload,
  workflowNeedsCredentials,
  currentBudgetState,
}: CurrentSubmitReadinessOptions = {}) {
  return resolveSubmitReadiness({
    workflow,
    isMock: Boolean(configPort?.isMock?.()),
    desktopMode,
    desktopConfigured,
    uploadId,
    renderSourceJobId: currentRenderSourceJobId?.(),
    hasBrowserCredentials: Boolean(hasBrowserCredentials?.()),
    needsUpload: workflowNeedsUpload?.(workflow),
    needsCredentials: workflowNeedsCredentials?.(workflow),
    budgetBlocking: Boolean(asBudgetState(currentBudgetState?.())?.blocking),
  });
}

export function handleSubmitReadinessBlock({
  readiness,
  openSetupDialog,
  openBrowserCredentialsDialog,
  currentBudgetState,
  setText,
}: HandleSubmitReadinessBlockOptions = {}) {
  switch (readiness?.reason) {
    case SUBMIT_BLOCK_REASONS.DESKTOP_NOT_CONFIGURED:
      openSetupDialog?.();
      setText("error-box", "Hãy hoàn tất cấu hình ban đầu trước.");
      return true;
    case SUBMIT_BLOCK_REASONS.MISSING_CREDENTIALS:
      setText("error-box", "Hãy nhập thông tin xác thực OCR Provider hiện tại trước.");
      openBrowserCredentialsDialog?.();
      return true;
    case SUBMIT_BLOCK_REASONS.MISSING_UPLOAD:
      setText("error-box", "Hãy chọn và tải tệp PDF lên trước.");
      return true;
    case SUBMIT_BLOCK_REASONS.MISSING_RENDER_SOURCE:
      setText("error-box", "Hãy nhập Render source job ID trong cài đặt nhà phát triển trước.");
      return true;
    case SUBMIT_BLOCK_REASONS.BUDGET_BLOCKING: {
      const budget = asBudgetState(currentBudgetState?.());
      setText("error-box", `Số dư không đủ: ${budget?.message || "hãy nạp thêm rồi gửi lại"}. Hãy nạp thêm rồi gửi lại.`);
      return true;
    }
    default:
      return false;
  }
}

export async function ensureOcrCredentialsForSubmit({
  workflow,
  desktopMode,
  workflowNeedsCredentials,
  ensureOcrCredentialsReady,
  openBrowserCredentialsDialog,
  setText,
}: EnsureOcrCredentialsForSubmitOptions = {}) {
  if (!workflowNeedsCredentials?.(workflow)) {
    return true;
  }
  return Boolean(await ensureOcrCredentialsReady?.({
    onMissingToken: () => {
      setText("error-box", "Hãy nhập thông tin xác thực OCR Provider hiện tại trước.");
      if (!desktopMode) {
        openBrowserCredentialsDialog?.();
      }
    },
    onInvalidToken: (result) => {
      setText("error-box", result.summary || "Xác thực OCR Provider không đạt.");
      if (!desktopMode) {
        openBrowserCredentialsDialog?.();
      }
    },
  }));
}

export function publishSubmitSuccess({
  payload,
  state,
  renderJob,
  syncCurrentJobSnapshot,
  startJobPolling,
  libraryEventPort,
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  now = () => new Date().toISOString(),
}: PublishSubmitSuccessOptions = {}) {
  // The create event is already inserted and hydrated; avoid three forced full-page refreshes at 200/1500/4000ms that compound flicker.
  libraryEventPort?.publishJobCreated?.(payload);
  // One delayed soft sync aligns the document projection; soft reset keeps old items and does not force through workflow suspend.
  windowRef?.setTimeout?.(() => {
    libraryEventPort?.requestRefresh?.({ delay: 0, force: false });
  }, 800);
  const EventCtor = documentRef?.defaultView?.CustomEvent || globalThis.CustomEvent;
  const openWorkflowEvent = typeof EventCtor === "function"
    ? new EventCtor(APP_EVENTS.openTranslationWorkflow)
    : { type: APP_EVENTS.openTranslationWorkflow };
  documentRef?.dispatchEvent?.(openWorkflowEvent as Event);
  const job = asJobPayload(payload);
  syncCurrentJobSnapshot?.(state, payload, job?.job_id || "", {
    startedAt: now(),
  });
  renderJob?.(payload);
  startJobPolling?.(job?.job_id);
}

export async function runSubmitFlow({
  workflow,
  desktopMode,
  configPort,
  state,
  apiPrefix,
  uploadId,
  desktopConfigured,
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
  syncCurrentJobSnapshot,
  renderJob,
  startJobPolling,
  libraryEventPort,
  isMissingUploadError,
  handleMissingUploadError,
  documentRef,
  windowRef,
  now,
}: RunSubmitFlowOptions = {}) {
  if (configPort?.isMock?.()) {
    setText("error-box", "-");
    const payload = await submitJobRequest(apiPrefix, { workflow, source: {}, mock: true });
    publishSubmitSuccess({
      payload,
      state,
      renderJob,
      syncCurrentJobSnapshot,
      startJobPolling,
      libraryEventPort,
      documentRef,
      windowRef,
      now,
    });
    return { status: "submitted", payload, mock: true };
  }

  const readiness = currentSubmitReadiness({
    workflow,
    configPort,
    desktopMode,
    desktopConfigured,
    uploadId,
    currentRenderSourceJobId,
    hasBrowserCredentials,
    workflowNeedsUpload,
    workflowNeedsCredentials,
    currentBudgetState,
  });
  if (!readiness.ready) {
    handleSubmitReadinessBlock({
      readiness,
      openSetupDialog,
      openBrowserCredentialsDialog,
      currentBudgetState,
      setText,
    });
    return { status: "blocked", readiness };
  }
  if (!validateBeforeSubmit?.()) {
    return { status: "invalid_page_ranges" };
  }
  if (!(await ensureDeepSeekBudgetReady({
    workflow,
    workflowNeedsUpload,
    currentBudgetState,
    refreshDeepSeekBalance,
    setText,
  }))) {
    return { status: "budget_not_ready" };
  }
  if (!(await ensureOcrCredentialsForSubmit({
    workflow,
    desktopMode,
    workflowNeedsCredentials,
    ensureOcrCredentialsReady,
    openBrowserCredentialsDialog,
    setText,
  }))) {
    return { status: "ocr_credentials_not_ready" };
  }

  setText("error-box", "-");

  try {
    const runPayload = collectRunPayload?.();
    const payload = await submitJobRequest(apiPrefix, runPayload);
    publishSubmitSuccess({
      payload,
      state,
      renderJob,
      syncCurrentJobSnapshot,
      startJobPolling,
      libraryEventPort,
      documentRef,
      windowRef,
      now,
    });
    return { status: "submitted", payload, mock: false };
  } catch (err) {
    if (isMissingUploadError?.(err)) {
      handleMissingUploadError?.();
      return { status: "missing_upload", error: err };
    }
    setText("error-box", buildErrorDiagnostic(err, {
      operation: "Gửi tác vụ PDF",
      url: `${apiPrefix || ""}/jobs`,
      details: {
        workflow,
        upload_id: uploadId,
        render_source_job_id: currentRenderSourceJobId?.(),
      },
    }));
    return { status: "error", error: err };
  }
}
