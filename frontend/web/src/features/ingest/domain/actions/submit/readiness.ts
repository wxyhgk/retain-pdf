import { getApiAuthMode } from "@retainpdf/api/http";
import {
  resolveSubmitReadiness,
  SUBMIT_BLOCK_REASONS,
} from "@/platform/contracts/submit-readiness-contract.js";
import type {
  CurrentSubmitReadinessOptions,
  HandleSubmitReadinessBlockOptions,
} from "./contracts.js";
import { asBudgetState } from "./normalizers.js";

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
    // 多用户模式下 OCR / 翻译的凭证由服务器统一管，用户不填，也不拦。
    hasBrowserCredentials: getApiAuthMode() === "multi" || Boolean(hasBrowserCredentials?.()),
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
}: HandleSubmitReadinessBlockOptions) {
  switch (readiness?.reason) {
    case SUBMIT_BLOCK_REASONS.DESKTOP_NOT_CONFIGURED:
      openSetupDialog?.();
      setText("error-box", "请先完成首次配置。");
      return true;
    case SUBMIT_BLOCK_REASONS.MISSING_CREDENTIALS:
      // 这道闸要求 OCR 和翻译两把 Key 都在（见 hasCompleteCredentials），缺哪把都会走到这里；
      // 以前只说 OCR，缺翻译 Key 的人会去 OCR 那栏找半天。设置窗口会打开，空着的那栏一眼能看到。
      setText("error-box", "请先在接口设置里填好 OCR 和翻译模型的 Key。");
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
