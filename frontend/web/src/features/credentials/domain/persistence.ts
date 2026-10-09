import {
  buildBrowserCredentialConfig,
  buildTaskOptionsFromDialogValues,
} from "./dialog-values.js";
import type { CredentialDialogValues } from "./dialog-values.js";


export async function persistDesktopCredentialsFromDialog({
  currentOcrProvider,
  defaultModelApiKey,
  defaultModelBaseUrl,
  saveTaskOptions,
  saveDesktopConfig,
  checkApiConnectivity,
  values,
  setupModePort,
}: {
  currentOcrProvider: () => string;
  defaultModelApiKey?: () => string;
  defaultModelBaseUrl?: () => string;
  saveTaskOptions?: (options: ReturnType<typeof buildTaskOptionsFromDialogValues>) => unknown;
  saveDesktopConfig?: (
    browserConfig?: Record<string, unknown>,
    afterSave?: () => unknown,
  ) => Promise<unknown> | unknown;
  checkApiConnectivity?: () => Promise<unknown> | unknown;
  values: CredentialDialogValues;
  setupModePort: { currentSetupMode: () => boolean };
}) {
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
      mineruToken: `${values.mineruToken || ""}`.trim(),
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
