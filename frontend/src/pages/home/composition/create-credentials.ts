// credentials Tính năng + dialog stores。

import {
  API_PREFIX,
  defaultModelApiKey,
  defaultModelBaseUrl,
  defaultPaddleToken,
  saveBrowserStoredConfig,
  savePersistedBrowserStoredConfig,
  savePersistedDeveloperStoredConfig,
  getDeveloperConfig,
  setDeveloperConfig,
  setDesktopConfigured,
  readHiddenCredentialDomInputs,
  createCredentialRuntimeEnvPort,
  mountBrowserCredentialsFeature,
  validatePaddleToken,
} from "./external.js";
import { createCredentialsViewFeature } from "../features/credentials/credentials-view-store.js";
import { createCredentialsDialogStore } from "../features/credentials/credentials-dialog-store.js";
import { createSettingsHubDialogStore } from "../features/settings/settings-hub-dialog-store.js";
import type {
  AsyncFn,
  BrowserCredentialsFeature,
  CredentialsStatePort,
  CredentialsViewBag,
  HomeFeatures,
  UploadStatePort,
} from "./types.js";
import type { DialogStore } from "../state/dialog-store.js";

type CreateCredentialsArgs = {
  features: HomeFeatures;
  legacyState: Record<string, unknown>;
  credentialsStatePort: CredentialsStatePort;
  uploadStatePort: UploadStatePort;
  validateOcrTokenOverride?: AsyncFn | null;
  validateDeepSeekTokenOverride?: AsyncFn;
  queryDeepSeekBalanceOverride?: AsyncFn;
  checkApiConnectivityOverride?: AsyncFn | null;
  saveDesktopConfigOverride?: AsyncFn | null;
};

export function createCredentials({
  features,
  legacyState,
  credentialsStatePort,
  uploadStatePort,
  validateOcrTokenOverride,
  validateDeepSeekTokenOverride,
  queryDeepSeekBalanceOverride,
  checkApiConnectivityOverride,
  saveDesktopConfigOverride,
}: CreateCredentialsArgs): {
  browserCredentialsFeature: BrowserCredentialsFeature;
  credentialsView: CredentialsViewBag;
  credentialsDialogStore: DialogStore;
  settingsHubDialogStore: DialogStore;
} {
  const credentialsDialogStore = createCredentialsDialogStore();
  const settingsHubDialogStore = createSettingsHubDialogStore();
  const credentialsView = createCredentialsViewFeature({ dialogStore: credentialsDialogStore });

  function saveCredentialTaskOptions(options: Record<string, unknown> = {}) {
    setDeveloperConfig(legacyState, { ...getDeveloperConfig(legacyState), ...options });
    void savePersistedDeveloperStoredConfig(getDeveloperConfig(legacyState));
  }

  async function saveDesktopCredentialConfig(
    browserConfig: Record<string, unknown> = {},
    afterSave?: () => unknown,
  ) {
    const source = (browserConfig && typeof browserConfig === "object") ? browserConfig : {};
    const persisted = await savePersistedBrowserStoredConfig({ ...source });
    setDeveloperConfig(legacyState, persisted.developerConfig || getDeveloperConfig(legacyState));
    credentialsStatePort.setCredentials(persisted.browserConfig || {});
    if (source.markConfigured) {
      setDesktopConfigured(legacyState, true);
    }
    await afterSave?.();
    return persisted;
  }

  async function validateCredentialOcrToken(
    apiPrefixArg: unknown,
    _providerId: unknown,
    token: unknown,
  ) {
    return validatePaddleToken(apiPrefixArg, {
      paddle_token: token,
      base_url: "https://paddleocr.aistudio-app.com",
    });
  }

  // balance/legacy ports Tại địa điểm: mount Triển khai mặc định tích hợp；Chữ ký cơ bản vẫn được đánh dấu là bắt buộc。
  const browserCredentialsFeature = mountBrowserCredentialsFeature({
    apiPrefix: API_PREFIX,
    state: {},
    credentialsStatePort,
    applyHiddenCredentialInputs: credentialsStatePort.setCredentials,
    defaultPaddleToken,
    defaultModelApiKey,
    defaultModelBaseUrl,
    getTaskOptions: () => features.workflowFeature.developerConfigWithDefaults() || {},
    saveTaskOptions: saveCredentialTaskOptions,
    saveBrowserStoredConfig,
    readHiddenCredentialInputs: readHiddenCredentialDomInputs,
    saveDesktopConfig: saveDesktopConfigOverride || saveDesktopCredentialConfig,
    checkApiConnectivity: checkApiConnectivityOverride || (() => Promise.resolve()),
    validateOcrToken: validateOcrTokenOverride || validateCredentialOcrToken,
    validateDeepSeekToken: validateDeepSeekTokenOverride,
    queryDeepSeekBalance: queryDeepSeekBalanceOverride,
    onCredentialStateChange: () => {
      features.workflowFeature.applyWorkflowMode();
      // Thông báo AI Nhập kiểm soát truy cập, v.v.：Chỉ nhận ra những người trong cài đặt modelApiKey
      try {
        // dynamic import path avoided — event is fire-and-forget string
        document.dispatchEvent(new CustomEvent("retainpdf:credentials-changed"));
      } catch {
        /* ignore */
      }
    },
    runtimeEnvPort: createCredentialRuntimeEnvPort(legacyState),
    uploadStatePort,
    viewPort: credentialsView.viewPort,
    dialogElementsPort: credentialsView.elementsPort,
    setupModePort: {
      currentSetupMode: () => credentialsView.store.getSnapshot().setupMode,
    },
  }) as BrowserCredentialsFeature;

  return {
    browserCredentialsFeature,
    credentialsView: credentialsView as CredentialsViewBag,
    credentialsDialogStore,
    settingsHubDialogStore,
  };
}
