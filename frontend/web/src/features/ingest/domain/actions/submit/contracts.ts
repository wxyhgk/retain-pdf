// 提交链路的共享类型与常量。
// 原 domain/actions/submit-flow.ts 拆分的公共契约集中处；submit-flow.ts 原样转出。

export const DEEPSEEK_BALANCE_CHECK_TIMEOUT_MS = 12000;

/** DeepSeek 余额/预算快照（workflow budget 侧）。 */
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
  status?: string | number;
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
  clearTimeout?: (id?: number) => void;
}

/** setText 接收 string 或 diagnostic 对象（error-box 侧再格式化）。 */
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
  setText: SetTextFn;
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
  setText: SetTextFn;
}

export interface EnsureOcrCredentialsForSubmitOptions {
  workflow?: string;
  desktopMode?: boolean;
  workflowNeedsCredentials?: (workflow?: string) => boolean | unknown;
  ensureOcrCredentialsReady?: (options?: {
    onMissingToken?: () => void;
    onInvalidToken?: (result?: OcrCredentialCheckResult | null) => void;
  }) => Promise<boolean | unknown> | boolean | unknown;
  openBrowserCredentialsDialog?: (options?: unknown) => void;
  setText: SetTextFn;
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
  startJobPolling?: (jobId: string) => void;
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
  apiPrefix: string;
  uploadId?: string;
  desktopConfigured?: boolean;
  openSetupDialog?: () => void;
  openBrowserCredentialsDialog?: (options?: unknown) => void;
  setText: SetTextFn;
  submitJobRequest: (apiPrefix: string, payload: unknown) => Promise<unknown> | unknown;
  workflowNeedsUpload?: (workflow?: string) => boolean | unknown;
  workflowNeedsCredentials?: (workflow?: string) => boolean | unknown;
  currentRenderSourceJobId?: () => string | unknown;
  currentBudgetState?: (workflow?: string) => BudgetStateSnapshot | null | undefined | unknown;
  collectRunPayload?: () => unknown;
  validateBeforeSubmit?: () => boolean | unknown;
  ensureOcrCredentialsReady?: EnsureOcrCredentialsForSubmitOptions["ensureOcrCredentialsReady"];
  hasBrowserCredentials?: () => boolean | unknown;
  refreshDeepSeekBalance?: EnsureDeepSeekBudgetReadyOptions["refreshDeepSeekBalance"];
  /** provider 预检（余额/OCR Token）失败时的告知口。预检不再挡提交，
   *  结果也不再写 error-box（弹窗那时已关），composition 接的是 toast。 */
  notifyPreflightWarning?: (message: string) => void;
  syncCurrentJobSnapshot?: PublishSubmitSuccessOptions["syncCurrentJobSnapshot"];
  renderJob?: (payload?: unknown) => void;
  startJobPolling?: (jobId: string) => void;
  libraryEventPort?: LibraryEventPortLike;
  isMissingUploadError?: (error: unknown) => boolean;
  handleMissingUploadError?: () => void;
  documentRef?: DocumentRefLike | Document | null;
  windowRef?: WindowRefLike | Window | null;
  now?: () => string;
}
