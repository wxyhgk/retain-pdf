import type { RunSubmitFlowOptions } from "./contracts.js";
import { currentSubmitReadiness, handleSubmitReadinessBlock } from "./readiness.js";
import { startSubmitPreflight } from "./preflight.js";
import { publishSubmitSuccess } from "./progress.js";
import { reportSubmitError } from "./errors.js";

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
  notifyPreflightWarning,
}: RunSubmitFlowOptions) {
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
  // [3] provider 预检(余额/OCR Token):**不再挡在提交前面**。
  //
  // 这两道各是一次第三方网络往返(余额检测超时上限 12 秒),而 OCR 校验缓存是纯
  // 内存的,每次刷新后的第一次提交都要重跑全程——点「直接翻译」要干等,任务迟迟
  // 不落盘。这里只负责发起,不 await;结果经 notifyPreflightWarning 报出。
  //
  // 为什么这样是安全的:「压根没填凭据」由上面 [1] 的 readiness 拦着(纯本地判断,
  // 不走网络),这两道只覆盖「填了但无效 / 余额不够」——那类问题本来也要等流水线
  // 跑到那一步才暴露,提前告知是加分项,不是提交的前置条件。
  void startSubmitPreflight({
    workflow,
    desktopMode,
    workflowNeedsUpload,
    workflowNeedsCredentials,
    currentBudgetState,
    refreshDeepSeekBalance,
    ensureOcrCredentialsReady,
    notifyPreflightWarning,
  });

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
    reportSubmitError({
      err,
      workflow,
      apiPrefix,
      uploadId,
      currentRenderSourceJobId,
      collectRunPayload,
      setText,
    });
    return { status: "error", error: err };
  }
}
