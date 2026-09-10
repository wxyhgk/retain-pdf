// credentials 特性 + dialog stores。

import { API_PREFIX } from "@/platform/config/api-constants.js";
import {
  defaultModelApiKey,
  defaultModelBaseUrl,
  defaultPaddleToken,
} from "@/platform/config/runtime.js";
import {
  saveBrowserStoredConfig,
  savePersistedBrowserStoredConfig,
  savePersistedDeveloperStoredConfig,
} from "@/platform/config/persisted-config.js";
import { savePersistedDesktopConfig } from "@/platform/config/desktop-persistence.js";
import {
  createCredentialRuntimeEnvPort,
  mountBrowserCredentialsFeature,
  readHiddenCredentialDomInputs,
} from "@/features/credentials/index.js";
import {
  getDeveloperConfig,
  setDeveloperConfig,
  setDesktopConfigured,
} from "@/platform/desktop/state.js";
import {
  createCredential,
  listCredentials,
  updateCredential,
  validatePaddleToken,
} from "@/platform/api/index.js";
import { createCredentialsViewFeature } from "@/features/credentials/index.js";
import type {
  AsyncFn,
  BrowserCredentialsFeature,
  CredentialsStatePort,
  CredentialsViewBag,
  HomeFeatures,
  UploadStatePort,
} from "./types.js";
import { createDialogStore, type DialogStore } from "@/platform/store/dialog-store.js";

type CreateCredentialsArgs = {
  features: HomeFeatures;
  legacyState: Record<string, unknown>;
  credentialsStatePort: CredentialsStatePort;
  uploadStatePort: UploadStatePort;
  validateOcrTokenOverride?: AsyncFn | null;
  validateDeepSeekTokenOverride?: AsyncFn;
  queryDeepSeekBalanceOverride?: AsyncFn;
  listCredentialsOverride?: AsyncFn;
  createCredentialOverride?: AsyncFn;
  updateCredentialOverride?: AsyncFn;
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
  listCredentialsOverride,
  createCredentialOverride,
  updateCredentialOverride,
  checkApiConnectivityOverride,
  saveDesktopConfigOverride,
}: CreateCredentialsArgs): {
  browserCredentialsFeature: BrowserCredentialsFeature;
  credentialsView: CredentialsViewBag;
  credentialsDialogStore: DialogStore;
  settingsHubDialogStore: DialogStore;
} {
  const credentialsDialogStore = createDialogStore();
  // payload 承载"打开时激活哪个 tab"（api/glossary/update），默认 api。
  const settingsHubDialogStore = createDialogStore({ tab: "api" });
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
    let persisted = await savePersistedBrowserStoredConfig({ ...source });
    setDeveloperConfig(legacyState, persisted.developerConfig || getDeveloperConfig(legacyState));
    credentialsStatePort.setCredentials(persisted.browserConfig || {});
    if (source.markConfigured) {
      if (!persisted.firstRunCompleted) {
        persisted = await savePersistedDesktopConfig({ firstRunCompleted: true });
      }
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
    const resolvedApiPrefix = typeof apiPrefixArg === "string" ? apiPrefixArg : API_PREFIX;
    const resolvedToken = typeof token === "string" ? token : "";
    return validatePaddleToken(resolvedApiPrefix, {
      paddle_token: resolvedToken,
      base_url: "https://paddleocr.aistudio-app.com",
    });
  }

  // balance/legacy ports 在 mount 内有默认实现；下层签名仍标成必填。
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
    listCredentials: listCredentialsOverride || listCredentials,
    createCredential: createCredentialOverride || createCredential,
    updateCredential: updateCredentialOverride || updateCredential,
    onCredentialStateChange: () => {
      features.workflowFeature.applyWorkflowMode();
      // 通知依赖凭据状态的界面刷新；AI Runtime 自己的后端凭据仍是独立真值。
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
