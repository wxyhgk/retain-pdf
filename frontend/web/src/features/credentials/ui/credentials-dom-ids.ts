// Credentials/SettingsHub 对话框的 DOM 契约 id 拷贝。
//
// 拷贝自 src/js/features/credentials/credentials-dom-contract.js(该文件名
// 命中 architecture-boundaries.test.mjs 的 features/*dom-contract.js 防回弹
// 正则,即便内容本身只是零逻辑 id 常量——3b 状态卡域已用同一手法拷贝出
// status-card-dom-ids.js,这里照此处理)与
// src/js/components/dialogs/app-settings-dialog-contract.js(该目录整体属旧
// 自定义元素视图层,禁止 pages import)。id 字符串逐一保留,视觉基线与
// 门禁按这些 id 断言;新增 id 一律不改名旧世界字符串。

export const CREDENTIAL_DOM_IDS = {
  dialog: "browser-credentials-dialog",
  trigger: "credentials-btn",
  gate: "credential-gate",
  gateAction: "credential-gate-action",
  file: "file",
  hidden: {
    ocrProvider: "ocr_provider",
    paddleToken: "paddle_token",
    modelApiKey: "api_key",
  },
  browser: {
    title: "browser-credentials-title",
    subtitle: "browser-credentials-subtitle",
    closeButton: "browser-credentials-close-btn",
    status: "browser-credentials-status",
    tabs: "browser-credentials-tabs",
    tabApi: "browser-credential-tab-api",
    tabTask: "browser-credential-tab-task",
    saveButton: "browser-credentials-save-btn",
    ocrProviderSelect: "browser-ocr-provider-select",
    apiKey: "browser-api-key",
    translationProvider: "browser-translation-provider",
    modelBaseUrl: "browser-model-base-url",
    modelName: "browser-model-name",
    translationWorkers: "browser-translation-workers",
    mathMode: "browser-job-math-mode",
    deepSeekValidateButton: "browser-deepseek-validate-btn",
    deepSeekTopUpLink: "browser-deepseek-top-up-link",
    deepSeekValidation: "browser-deepseek-validation",
  },
};

// OCR provider 面板/校验/token 输入 id 全部按 provider.id 拼接(镜像旧
// components/dialogs/browser-credentials-dialog.js 的模板拼接规则)。
export function credentialTokenInputId(providerId = "") {
  return `browser-${providerId}-token`;
}

export function credentialValidateButtonId(providerId = "") {
  return `browser-${providerId}-validate-btn`;
}

export function credentialValidationId(providerId = "") {
  return `browser-${providerId}-validation`;
}

export const CREDENTIAL_DOM_DATASETS = {
  setupMode: "setupMode",
  credentialTab: "credentialTab",
  credentialPanel: "credentialPanel",
  ocrProviderPanel: "ocrProviderPanel",
};

// SettingsHubDialog(蓝图 §0.4,拷贝自
// src/js/components/dialogs/app-settings-dialog-contract.js)。
// Decoupled: 真值随 settings 功能迁至 src/features/settings。
// (settings → credentials coupling removed). Re-export for backward-compat.
export { APP_SETTINGS_DIALOG_IDS, APP_SETTINGS_DIALOG_DATASETS } from "@/features/settings/index.js";
