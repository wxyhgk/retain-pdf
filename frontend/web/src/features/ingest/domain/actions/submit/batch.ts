// 一次上传多本以后的提交：同样的就绪校验、同一套选项，每本一个任务，按顺序交。
//
// 和单本的 runner 的区别：
// - 不接管全局任务进度、不跳书籍详情——一次交了好几本，书架上的卡片自己会跟进度；
// - 每本整本处理，不看页码输入框；
// - 后端拒收（磁盘空间不够、排队的任务满了）时，剩下的不再交，各自标上原因。
// 关弹窗由调用方决定：全交上了才关，有失败的留着让用户看。

import { isRefusedSubmission } from "@/platform/api/index.js";
import type { RunSubmitFlowOptions } from "./contracts.js";
import { currentSubmitReadiness, handleSubmitReadinessBlock } from "./readiness.js";
import { startSubmitPreflight } from "./preflight.js";

export type BatchSubmitItemResult =
  | { ok: true; jobId: string }
  | { ok: false; message: string };

export type BatchSubmitResult = {
  status: "blocked" | "done";
  submitted: number;
  failed: number;
  readiness?: unknown;
};

export type RunBatchSubmitOptions = Pick<
  RunSubmitFlowOptions,
  | "workflow"
  | "desktopMode"
  | "configPort"
  | "apiPrefix"
  | "desktopConfigured"
  | "openSetupDialog"
  | "openBrowserCredentialsDialog"
  | "setText"
  | "submitJobRequest"
  | "workflowNeedsUpload"
  | "workflowNeedsCredentials"
  | "currentRenderSourceJobId"
  | "currentBudgetState"
  | "ensureOcrCredentialsReady"
  | "hasBrowserCredentials"
  | "refreshDeepSeekBalance"
  | "libraryEventPort"
  | "notifyPreflightWarning"
> & {
  uploadIds: string[];
  collectRunPayload: (overrides: { uploadId: string; pageRanges: string }) => unknown;
  onItem?: (uploadId: string, result: BatchSubmitItemResult) => void;
};

function errorText(err: unknown) {
  return `${(err as { message?: string } | null)?.message || err || "提交失败"}`.trim();
}

export async function runBatchSubmit({
  uploadIds,
  collectRunPayload,
  onItem,
  workflow,
  desktopMode,
  configPort,
  apiPrefix,
  desktopConfigured,
  openSetupDialog,
  openBrowserCredentialsDialog,
  setText,
  submitJobRequest,
  workflowNeedsUpload,
  workflowNeedsCredentials,
  currentRenderSourceJobId,
  currentBudgetState,
  ensureOcrCredentialsReady,
  hasBrowserCredentials,
  refreshDeepSeekBalance,
  libraryEventPort,
  notifyPreflightWarning,
}: RunBatchSubmitOptions): Promise<BatchSubmitResult> {
  const mock = Boolean(configPort?.isMock?.());
  if (!mock) {
    // 就绪校验只看一次：凭据、首次配置这些对每本都一样，拿第一本的上传编号代表。
    const readiness = currentSubmitReadiness({
      workflow,
      configPort,
      desktopMode,
      desktopConfigured,
      uploadId: uploadIds[0],
      currentRenderSourceJobId,
      hasBrowserCredentials,
      workflowNeedsUpload,
      workflowNeedsCredentials,
      currentBudgetState,
    });
    if (!readiness.ready) {
      handleSubmitReadinessBlock({ readiness, openSetupDialog, openBrowserCredentialsDialog, currentBudgetState, setText });
      return { status: "blocked", submitted: 0, failed: 0, readiness };
    }
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
  }
  setText("error-box", "-");

  let submitted = 0;
  let failed = 0;
  let stopReason = "";
  for (const uploadId of uploadIds) {
    if (stopReason) {
      failed += 1;
      // 没发请求，原因和挡住它的那本一样。
      onItem?.(uploadId, { ok: false, message: stopReason });
      continue;
    }
    try {
      const payload = await submitJobRequest(
        apiPrefix,
        mock ? { workflow, source: {}, mock: true } : collectRunPayload({ uploadId, pageRanges: "" }),
      );
      libraryEventPort?.publishJobCreated?.(payload);
      submitted += 1;
      onItem?.(uploadId, { ok: true, jobId: `${(payload as { job_id?: string } | null)?.job_id || ""}` });
    } catch (err) {
      failed += 1;
      onItem?.(uploadId, { ok: false, message: errorText(err) });
      // 磁盘空间不够、排队满了：后面的交了也一样被拒。
      if (isRefusedSubmission(err)) stopReason = errorText(err);
    }
  }
  if (submitted) {
    libraryEventPort?.requestRefresh?.({ delay: 0, force: false });
  }
  return { status: "done", submitted, failed };
}
