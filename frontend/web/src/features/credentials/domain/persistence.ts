import {
  buildBrowserCredentialConfig,
  buildTaskOptionsFromDialogValues,
} from "./dialog-values.js";


export async function persistDesktopCredentialsFromDialog({
  currentOcrProvider,
  defaultModelApiKey,
  defaultModelBaseUrl,
  saveTaskOptions,
  saveDesktopConfig,
  checkApiConnectivity,
  values,
  setupModePort,
}: any) {
  const provider = currentOcrProvider();
  const ocrCredentialRef = `${values.ocrCredentialRef || ""}`.trim();
  const translationCredentialRef = `${values.translationCredentialRef || ""}`.trim();
  const paddleToken = `${values.paddleToken || ""}`.trim();
  const modelApiKey = `${values.modelApiKey || defaultModelApiKey?.() || ""}`.trim();
  await saveDesktopConfig?.(
    {
      ocrProvider: provider,
      ocrCredentialRef,
      paddleToken,
      translationCredentialRef,
      modelApiKey,
      markConfigured: setupModePort.currentSetupMode(),
    },
    async () => {
      await checkApiConnectivity?.();
    },
  );
  saveTaskOptions?.(buildTaskOptionsFromDialogValues({
    values,
    defaultModelBaseUrl,
  }));
}
