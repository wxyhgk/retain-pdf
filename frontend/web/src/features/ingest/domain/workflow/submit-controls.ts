import { resolveSubmitReadiness } from "@/platform/contracts/submit-readiness-contract.js";

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
}: any) {
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
  return {
    disabled: !readiness.ready,
    label: workflowSubmitLabel(workflow),
    actionVisible: !(readiness.credentialsMissing || (needsUpload ? !readiness.uploadReady : false)),
    pageRangeVisible: showPageRangeButton,
    readiness,
  };
}
