import { normalizeOcrProvider } from "@/platform/config/providers.js";

export function syncCredentialDialogFields({
  credentials,
  taskOptions = {},
  defaultModelBaseUrl,
  defaultModelApiKey,
  elementsPort,
}: any) {
  const {
    paddleInput,
    apiKeyInput,
    modelBaseUrlInput,
    modelNameInput,
    translationWorkersInput,
    mathModeSelect,
  } = elementsPort.elements();

  if (paddleInput) {
    paddleInput.value = credentials.paddleToken || "";
  }
  if (apiKeyInput) {
    apiKeyInput.value = credentials.modelApiKey || defaultModelApiKey?.() || "";
  }
  if (modelBaseUrlInput) {
    modelBaseUrlInput.value = taskOptions.baseUrl || defaultModelBaseUrl?.() || "";
    elementsPort.syncTranslationProvider?.(modelBaseUrlInput.value);
  }
  if (modelNameInput) {
    modelNameInput.value = taskOptions.model || "";
  }
  if (translationWorkersInput) {
    translationWorkersInput.value = `${taskOptions.workers || 50}`;
  }
  if (mathModeSelect) {
    mathModeSelect.value = taskOptions.mathMode === "placeholder" ? "placeholder" : "direct_typst";
  }
  elementsPort.syncOcrProviderControls(normalizeOcrProvider(credentials.ocrProvider));
}
