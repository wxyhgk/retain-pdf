import { normalizeOcrProvider } from "@/platform/config/providers.js";
import type { CredentialsFields } from "./state.js";
import type { CredentialDialogElementsLike } from "./dialog-values.js";

export function syncCredentialDialogFields({
  credentials,
  taskOptions = {},
  defaultModelBaseUrl,
  defaultModelApiKey,
  elementsPort,
}: {
  // modelApiKey 由调用方从翻译档案回填，类型上是 unknown，写入 DOM 时统一按字符串化处理。
  credentials: Partial<Omit<CredentialsFields, "modelApiKey">> & { modelApiKey?: unknown };
  taskOptions?: Record<string, unknown>;
  defaultModelBaseUrl?: () => string;
  defaultModelApiKey?: () => string;
  elementsPort: {
    elements: () => CredentialDialogElementsLike;
    syncOcrProviderControls?: (providerId?: string) => void;
    syncTranslationProvider?: (baseUrl?: string) => void;
  };
}) {
  const {
    paddleInput,
    mineruInput,
    apiKeyInput,
    modelBaseUrlInput,
    modelNameInput,
    translationWorkersInput,
    mathModeSelect,
  } = elementsPort.elements();

  if (paddleInput) {
    paddleInput.value = credentials.paddleToken || "";
  }
  if (mineruInput) {
    mineruInput.value = credentials.mineruToken || "";
  }
  if (apiKeyInput) {
    apiKeyInput.value = `${credentials.modelApiKey || defaultModelApiKey?.() || ""}`;
  }
  if (modelBaseUrlInput) {
    modelBaseUrlInput.value = `${taskOptions.baseUrl || defaultModelBaseUrl?.() || ""}`;
    elementsPort.syncTranslationProvider?.(modelBaseUrlInput.value);
  }
  if (modelNameInput) {
    modelNameInput.value = `${taskOptions.model || ""}`;
  }
  if (translationWorkersInput) {
    translationWorkersInput.value = `${taskOptions.workers || 50}`;
  }
  if (mathModeSelect) {
    mathModeSelect.value = taskOptions.mathMode === "placeholder" ? "placeholder" : "direct_typst";
  }
  elementsPort.syncOcrProviderControls(normalizeOcrProvider(credentials.ocrProvider));
}
