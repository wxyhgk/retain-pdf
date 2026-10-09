import type { EnsureOcrCredentialsForSubmitOptions } from "./contracts.js";

export async function ensureOcrCredentialsForSubmit({
  workflow,
  desktopMode,
  workflowNeedsCredentials,
  ensureOcrCredentialsReady,
  openBrowserCredentialsDialog,
  setText,
}: EnsureOcrCredentialsForSubmitOptions) {
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
      setText("error-box", result?.summary || "OCR Provider 凭证校验未通过。");
      if (!desktopMode) {
        openBrowserCredentialsDialog?.();
      }
    },
  }));
}
