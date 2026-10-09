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
  updateCredential,
  validateMineruToken,
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
  /** create-home-composition 总会给（默认就是平台的 validateDeepSeekToken）。 */
  validateDeepSeekTokenOverride: AsyncFn;
  queryDeepSeekBalanceOverride?: AsyncFn;
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
  createCredentialOverride,
  updateCredentialOverride,
  checkApiConnectivityOverride,
  saveDesktopConfigOverride,
}: CreateCredentialsArgs): {
  browserCredentialsFeature: BrowserCredentialsFeature;
  credentialsView: CredentialsViewBag;
  settingsHubDialogStore: DialogStore;
} {
  // payload 承载"打开时激活哪个 tab"（api/glossary/update），默认 api。
  const settingsHubDialogStore = createDialogStore({ tab: "api" });
  const credentialsView = createCredentialsViewFeature({
    closeDialog: () => settingsHubDialogStore.close(),
  });

  // 返回 Promise 并由调用方 await：桌面端这条是异步 IPC 写 snapshot，
  // 此前 `void` 掉会让模型名 / API URL / 并发数 / 各服务商 profile 的落盘
  // 变成 fire-and-forget——凭据(Key)是 await 的、任务选项不是，用户保存后
  // 立刻退出就会只丢一半，重进来 Key 还在但模型名没了，只能重填再存一次。
  // 失败也不再静默：抛给 save-flow 的 catch 去显示，别让用户以为已经存上。
  async function saveCredentialTaskOptions(options: Record<string, unknown> = {}) {
    setDeveloperConfig(legacyState, { ...getDeveloperConfig(legacyState), ...options });
    return savePersistedDeveloperStoredConfig(getDeveloperConfig(legacyState));
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
    providerId: unknown,
    token: unknown,
  ) {
    const resolvedApiPrefix = typeof apiPrefixArg === "string" ? apiPrefixArg : API_PREFIX;
    const resolvedToken = typeof token === "string" ? token : "";
    if (providerId === "mineru") {
      return validateMineruToken(resolvedApiPrefix, { mineru_token: resolvedToken });
    }
    if (providerId !== "paddle") {
      return { ok: false, status: "unsupported", summary: "该 OCR 提供商暂不支持单独检测 Token" };
    }
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
    settingsHubDialogStore,
  };
}
