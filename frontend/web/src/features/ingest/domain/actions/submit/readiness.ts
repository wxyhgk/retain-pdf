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
}: HandleSubmitReadinessBlockOptions) {
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
