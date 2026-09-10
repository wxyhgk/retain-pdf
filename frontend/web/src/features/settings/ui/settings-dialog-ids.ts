// SettingsHub dialog DOM contract — extracted from credentials/credentials-dom-ids.ts
// to decouple settings → credentials.
//
// Previously credentials-dom-ids.ts owned both CREDENTIAL_DOM_IDS and
// APP_SETTINGS_DIALOG_IDS, forcing SettingsHubDialog to import from
// ../credentials/credentials-dom-ids.js (settings → credentials coupling).
// Now the source of truth for settings is this shared leaf; credentials-dom-ids.ts
// re-exports from here for backward-compat.

export const APP_SETTINGS_DIALOG_IDS = {
  dialog: "app-settings-dialog",
  openButton: "app-settings-btn",
  closeButton: "app-settings-close-btn",
  /** 已退役（设置 v2：API 区内嵌 CredentialsWorkbench，无二层弹窗入口）。
   *  保留常量仅供历史对照，勿再新增消费点。 */
  credentialsButton: "credentials-btn",
  // 词表/更新两个 tab 本阶段只占位(蓝图 §0.4);id 先落地供后续 agent 对齐。
  glossaryButton: "glossary-btn",
  appUpdateButton: "app-update-btn",
};

export const APP_SETTINGS_DIALOG_DATASETS = {
  settingsTab: "settingsTab",
  settingsPanel: "settingsPanel",
};
