export const SUBMIT_BLOCK_REASONS = Object.freeze({
  NONE: "",
  DESKTOP_NOT_CONFIGURED: "desktop_not_configured",
  MISSING_CREDENTIALS: "missing_credentials",
  MISSING_UPLOAD: "missing_upload",
  MISSING_RENDER_SOURCE: "missing_render_source",
  BUDGET_BLOCKING: "budget_blocking",
});

export function resolveSubmitReadiness({
  workflow,
  isMock = false,
  desktopMode = false,
  desktopConfigured = true,
  uploadId = "",
  renderSourceJobId = "",
  hasBrowserCredentials = false,
  needsUpload = true,
  needsCredentials = true,
  budgetBlocking = false,
}: any = {}) {
  const uploadReady = Boolean(uploadId);
  const renderReady = Boolean(renderSourceJobId);
  const desktopConfigMissing = Boolean(desktopMode) && !desktopConfigured && Boolean(needsCredentials);
  const credentialsMissing = !desktopMode && Boolean(needsCredentials) && !hasBrowserCredentials;
  const sourceReady = needsUpload ? uploadReady : renderReady;
  let reason: string = SUBMIT_BLOCK_REASONS.NONE;

  if (!isMock) {
    if (desktopConfigMissing) {
      reason = SUBMIT_BLOCK_REASONS.DESKTOP_NOT_CONFIGURED;
    } else if (credentialsMissing) {
      reason = SUBMIT_BLOCK_REASONS.MISSING_CREDENTIALS;
    } else if (needsUpload && !uploadReady) {
      reason = SUBMIT_BLOCK_REASONS.MISSING_UPLOAD;
    } else if (!needsUpload && !renderReady) {
      reason = SUBMIT_BLOCK_REASONS.MISSING_RENDER_SOURCE;
    } else if (budgetBlocking) {
      reason = SUBMIT_BLOCK_REASONS.BUDGET_BLOCKING;
    }
  }

  return {
    workflow,
    isMock: Boolean(isMock),
    needsUpload: Boolean(needsUpload),
    needsCredentials: Boolean(needsCredentials),
    uploadReady,
    renderReady,
    desktopConfigMissing,
    credentialsMissing,
    budgetBlocking: Boolean(budgetBlocking),
    sourceReady,
    reason,
    ready: Boolean(isMock) || reason === SUBMIT_BLOCK_REASONS.NONE,
  };
}
