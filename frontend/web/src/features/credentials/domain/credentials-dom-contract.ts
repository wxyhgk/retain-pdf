import { APP_DIALOG_IDS, APP_SHELL_IDS } from "@/platform/contracts/app-contract.js";

export const CREDENTIAL_DOM_IDS = {
  dialog: APP_DIALOG_IDS.browserCredentials,
  trigger: "credentials-btn",
  gate: "credential-gate",
  gateAction: APP_SHELL_IDS.credentialGateAction,
  file: "file",
  hidden: {
    ocrProvider: "ocr_provider",
    paddleToken: "paddle_token",
    modelApiKey: "api_key",
  },
  browser: {
    title: "browser-credentials-title",
    subtitle: "browser-credentials-subtitle",
    status: "browser-credentials-status",
    tabs: "browser-credentials-tabs",
    saveButton: "browser-credentials-save-btn",
    ocrProviderSelect: "browser-ocr-provider-select",
    paddleToken: "browser-paddle-token",
    apiKey: "browser-api-key",
    translationProvider: "browser-translation-provider",
    modelBaseUrl: "browser-model-base-url",
    modelName: "browser-model-name",
    mathMode: "browser-job-math-mode",
    paddleValidateButton: "browser-paddle-validate-btn",
    deepSeekValidateButton: "browser-deepseek-validate-btn",
    deepSeekTopUpLink: "browser-deepseek-top-up-link",
    validations: {
      paddle: "browser-paddle-validation",
      deepseek: "browser-deepseek-validation",
    },
  },
};

export const CREDENTIAL_DOM_DATASETS = {
  setupMode: "setupMode",
  credentialTab: "credentialTab",
  credentialPanel: "credentialPanel",
  ocrProviderPanel: "ocrProviderPanel",
  toggleSecret: "toggleSecret",
};

export const CREDENTIAL_DOM_SELECTORS = {
  trigger: `#${CREDENTIAL_DOM_IDS.trigger}, #${CREDENTIAL_DOM_IDS.gateAction}`,
  credentialTab: "[data-credential-tab]",
  credentialPanel: "[data-credential-panel]",
  ocrProviderPanel: "[data-ocr-provider-panel]",
  toggleSecret: "[data-toggle-secret]",
};

export function browserValidationIdForProvider(providerId = "") {
  const normalized = `${providerId || ""}`.trim().toLowerCase();
  return CREDENTIAL_DOM_IDS.browser.validations[normalized] || "";
}
