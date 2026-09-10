import { withTimeout } from "@/platform/utils/async-timeout.js";
import { buildErrorDiagnostic } from "@/platform/utils/error-diagnostics.js";
import {
  resolveSubmitReadiness,
  SUBMIT_BLOCK_REASONS,
} from "@/platform/contracts/submit-readiness-contract.js";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";

// 提交链路总览(显性化,不改行为;签名与事件名不变):
//   表单校验(WorkflowPanel.handleSubmit)→ 组参(collectRunPayload)→
//   提交(submitJobRequest)→ 接进度(sync 快照/renderJob/startJobPolling)→
//   关框(dispatch APP_EVENTS.closeTranslationWorkflow)。
// 每步成功→ 下一步;失败→ 返回对应 status 并停留,不继续向下走,详见 runSubmitFlow 内联。
// 分支: [MOCK] 直通提交(不做校验/预算/凭证); [真机] 全链路校验后提交。

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
  setText("error-box", "正在检测 DeepSeek 余额…");
  try {
    const result = asBalanceResult(await withTimeout(
      refreshDeepSeekBalance?.({ silent: true }) || Promise.resolve(null),
      timeoutMs,
      "DeepSeek 余额检测超时，请稍后重试或在接口设置中检测。",
    ));
    if (result?.status === "missing_key") {
      setText("error-box", "请先填写 DeepSeek API Key。");
      return false;
    }
    if (result?.status === "network_error") {
      setText("error-box", "DeepSeek 余额检测失败，请稍后重试或在接口设置中检测。");
      return false;
    }
  } catch (error) {
    setText("error-box", (error as { message?: string })?.message || "DeepSeek 余额检测失败，请稍后重试。");
    return false;
  }
  const budget = asBudgetState(currentBudgetState?.());
  if (budget?.blocking) {
    setText("error-box", `余额不足：${budget.message}。请充值后再提交。`);
    return false;
  }
  if (budget?.visible && !budget.balanceChecked) {
    setText("error-box", "无法确认 DeepSeek 余额，请先在接口设置中完成检测。");
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
      setText("error-box", "请先完成首次配置。");
      return true;
    case SUBMIT_BLOCK_REASONS.MISSING_CREDENTIALS:
      setText("error-box", "请先填写当前 OCR Provider 凭证。");
      openBrowserCredentialsDialog?.();
      return true;
    case SUBMIT_BLOCK_REASONS.MISSING_UPLOAD:
      setText("error-box", "请先选择并上传 PDF 文件");
      return true;
    case SUBMIT_BLOCK_REASONS.MISSING_RENDER_SOURCE:
      setText("error-box", "请先在开发者设置里填写 Render 源任务 ID。");
      return true;
    case SUBMIT_BLOCK_REASONS.BUDGET_BLOCKING: {
      const budget = asBudgetState(currentBudgetState?.());
      setText("error-box", `余额不足：${budget?.message || "请充值后再提交"}。请充值后再提交。`);
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
      setText("error-box", "请先填写当前 OCR Provider 凭证。");
      if (!desktopMode) {
        openBrowserCredentialsDialog?.();
      }
    },
    onInvalidToken: (result) => {
      setText("error-box", result.summary || "OCR Provider 凭证校验未通过。");
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
  // 接进度→关框(成功链,顺序不可换):publish 创建事件→ sync 快照→ renderJob→
  // startJobPolling→ dispatch close→ 800ms 兜底 soft refresh→ 5s 强制对账刷新。
  // 成功→ 下一步;任一可选口缺失→ 跳过该步继续,不抛错;close 无监听→ 仅丢事件。
  // 创建事件已 insert+hydrate；不再 200/1500/4000 三次 force 整页刷（叠乘闪烁）
  libraryEventPort?.publishJobCreated?.(payload);
  const job = asJobPayload(payload);

  // 先让全局 job runtime 接管新任务，再关闭上传弹窗。关闭弹窗只影响展示，
  // 不会停止后台轮询；同时 close 事件会解除书库刷新挂起并触发一次投影对账。
  syncCurrentJobSnapshot?.(state, payload, job?.job_id || "", {
    startedAt: now(),
  });
  renderJob?.(payload);
  startJobPolling?.(job?.job_id);

  const EventCtor = documentRef?.defaultView?.CustomEvent || globalThis.CustomEvent;
  const closeWorkflowEvent = typeof EventCtor === "function"
    ? new EventCtor(APP_EVENTS.closeTranslationWorkflow)
    : { type: APP_EVENTS.closeTranslationWorkflow };
  documentRef?.dispatchEvent?.(closeWorkflowEvent as Event);

  // close 事件通常会在 300ms 后刷新；这一轮 soft refresh 是无 DOM 订阅者时的兜底，
  // scheduler 会合并/节流重复刷新，且此时 workflow 已不再处于 suspended 状态。
  windowRef?.setTimeout?.(() => {
    libraryEventPort?.requestRefresh?.({ delay: 0, force: false });
  }, 800);
  // 兜底对账：后端建档/链文档可能慢于前 1 秒内的两次刷新（尤其同文件重传，
  // 文档行要等 active_job_id 落库）。5 秒后强制刷新一次，保证新任务可见，
  // 不用用户手动刷新。只此一次，不影响节流。
  windowRef?.setTimeout?.(() => {
    libraryEventPort?.requestRefresh?.({ delay: 0, force: true });
  }, 5000);
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
  // ---- 分支[MOCK]:不做表单校验/组参/预算/凭证,成功→ publishSubmitSuccess→
  // submitted;失败(抛错)→ 上抛由调用方处理,不落 error-box,不关框。 ----
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

  // ---- 分支[真机]:表单校验→组参→提交→接进度→关框 ----
  // [1] 表单校验(readiness):成功→ 下一步;失败→ blocked + error-box/弹框,不发请求。
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
  // [2] 页码校验:成功→ 下一步;失败→ invalid_page_ranges,不发请求。
  if (!validateBeforeSubmit?.()) {
    return { status: "invalid_page_ranges" };
  }
  // [3] 预算/余额:成功→ 下一步;失败→ budget_not_ready + error-box,不发请求。
  if (!(await ensureDeepSeekBudgetReady({
    workflow,
    workflowNeedsUpload,
    currentBudgetState,
    refreshDeepSeekBalance,
    setText,
  }))) {
    return { status: "budget_not_ready" };
  }
  // [4] OCR 凭证:成功→ 下一步;失败→ ocr_credentials_not_ready + error-box/弹框,不发请求。
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

  // [5] 组参+提交:成功→ publishSubmitSuccess(接进度→关框)→ submitted;
  // 失败(missing_upload)→ missing_upload 回上传态;其余→ error + error-box 诊断,不关框。
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
    const isOcr = `${workflow || (collectRunPayload?.() as any)?.workflow || ""}`.trim() === "ocr";
    setText("error-box", buildErrorDiagnostic(err, {
      operation: "提交 PDF 任务",
      url: `${apiPrefix || ""}${isOcr ? "/ocr/jobs" : "/jobs"}`,
      details: {
        workflow,
        upload_id: uploadId,
        render_source_job_id: currentRenderSourceJobId?.(),
      },
    }));
    return { status: "error", error: err };
  }
}
