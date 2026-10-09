import { resolveSubmitReadiness } from "@/platform/contracts/submit-readiness-contract.js";

export interface SubmitControlStateOptions {
  workflow?: string;
  isMock?: boolean;
  desktopMode?: boolean;
  desktopConfigured?: boolean;
  uploadId?: string;
  renderSourceJobId?: string;
  hasBrowserCredentials?: boolean;
  budgetBlocking?: boolean;
  workflowNeedsUpload: (workflow?: string) => boolean;
  workflowNeedsCredentials: (workflow?: string) => boolean;
  workflowSubmitLabel: (workflow?: string) => string;
}

export function resolveSubmitControlState({
  workflow,
  isMock,
  desktopMode,
  desktopConfigured = true,
  uploadId,
  renderSourceJobId,
  hasBrowserCredentials,
  budgetBlocking = false,
  workflowNeedsUpload,
  workflowNeedsCredentials,
  workflowSubmitLabel,
}: SubmitControlStateOptions) {
  const showPageRangeButton = workflowNeedsUpload(workflow);
  const needsUpload = workflowNeedsUpload(workflow);
  const needsCredentials = workflowNeedsCredentials(workflow);
  const readiness = resolveSubmitReadiness({
    workflow,
    isMock,
    desktopMode,
    desktopConfigured,
    uploadId,
    renderSourceJobId,
    hasBrowserCredentials,
    needsUpload,
    needsCredentials,
    budgetBlocking,
  });
  if (isMock) {
    return {
      disabled: false,
      label: workflowSubmitLabel(workflow),
      actionVisible: true,
      pageRangeVisible: showPageRangeButton,
    };
  }
  // 提交操作区常显：即使未上传/缺凭证也不隐藏按钮，而是保持禁用并由
  // UI 侧给出下一步指引（缺失项定位见 ProcessingChoicePanel 内的 submit-hint
  // 与 IngestDialog 的 blocked 聚焦）。这里只保证可见性，禁用逻辑不变。
  return {
    disabled: !readiness.ready,
    label: workflowSubmitLabel(workflow),
    actionVisible: true,
    pageRangeVisible: showPageRangeButton,
    readiness,
  };
}
