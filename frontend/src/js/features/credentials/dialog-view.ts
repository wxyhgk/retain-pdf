import { $ } from "../../dom/query.js";
import {
  CREDENTIAL_DOM_DATASETS,
  CREDENTIAL_DOM_IDS,
  CREDENTIAL_DOM_SELECTORS,
} from "./credentials-dom-contract.js";

const { browser: BROWSER_CREDENTIAL_IDS } = CREDENTIAL_DOM_IDS;

export type SetCredentialDialogModeViewOptions = {
  setupMode?: boolean;
  activateCredentialTab?: (tabName: string) => void;
};

export function credentialDialog(): HTMLDialogElement | null {
  return $(CREDENTIAL_DOM_IDS.dialog) as HTMLDialogElement | null;
}

export function currentCredentialDialogSetupMode() {
  return credentialDialog()?.dataset?.[CREDENTIAL_DOM_DATASETS.setupMode] === "1";
}

export function browserCredentialElements() {
  return {
    dialog: $(CREDENTIAL_DOM_IDS.dialog) as HTMLDialogElement | null,
    paddleInput: $(BROWSER_CREDENTIAL_IDS.paddleToken) as HTMLInputElement | null,
    apiKeyInput: $(BROWSER_CREDENTIAL_IDS.apiKey) as HTMLInputElement | null,
    modelBaseUrlInput: $(BROWSER_CREDENTIAL_IDS.modelBaseUrl) as HTMLInputElement | null,
    modelNameInput: $(BROWSER_CREDENTIAL_IDS.modelName) as HTMLInputElement | null,
    mathModeSelect: $(BROWSER_CREDENTIAL_IDS.mathMode) as HTMLSelectElement | null,
    trigger: $(CREDENTIAL_DOM_IDS.trigger) as HTMLElement | null,
  };
}

export function setCredentialDialogModeView({
  setupMode = false,
  activateCredentialTab,
}: SetCredentialDialogModeViewOptions = {}) {
  const dialog = credentialDialog();
  if (!dialog) {
    return;
  }
  dialog.dataset[CREDENTIAL_DOM_DATASETS.setupMode] = setupMode ? "1" : "0";
  const title = $(BROWSER_CREDENTIAL_IDS.title);
  if (title) {
    title.textContent = setupMode ? "Cau hinh lan dau" : "Cai dat API";
  }
  const subtitle = $(BROWSER_CREDENTIAL_IDS.subtitle);
  if (subtitle) {
    subtitle.textContent = "";
    subtitle.classList.add("hidden");
  }
  const saveButton = $(BROWSER_CREDENTIAL_IDS.saveButton);
  if (saveButton) {
    saveButton.textContent = setupMode ? "Luu va khoi dong" : "Luu";
  }
  $(BROWSER_CREDENTIAL_IDS.tabs)?.classList.toggle("hidden", setupMode);
  if (setupMode) {
    activateCredentialTab?.("api");
  }
}

export function setDialogStatus(message = "", tone = "") {
  const el = $(BROWSER_CREDENTIAL_IDS.status);
  if (!el) {
    return;
  }
  const content = `${message || ""}`.trim();
  el.textContent = content;
  el.classList.toggle("hidden", !content);
  el.classList.toggle("is-valid", tone === "valid");
  el.classList.toggle("is-error", tone === "error");
}

export function activateCredentialTabView(tabName = "api") {
  const dialog = credentialDialog();
  if (!dialog) {
    return;
  }
  dialog.querySelectorAll(CREDENTIAL_DOM_SELECTORS.credentialTab).forEach((tab) => {
    const tabEl = tab as HTMLElement;
    const active = tabEl.dataset[CREDENTIAL_DOM_DATASETS.credentialTab] === tabName;
    tabEl.classList.toggle("is-active", active);
    tabEl.setAttribute("aria-selected", active ? "true" : "false");
  });
  dialog.querySelectorAll(CREDENTIAL_DOM_SELECTORS.credentialPanel).forEach((panel) => {
    const panelEl = panel as HTMLElement;
    const active = panelEl.dataset[CREDENTIAL_DOM_DATASETS.credentialPanel] === tabName;
    panelEl.classList.toggle("is-active", active);
    panelEl.hidden = !active;
  });
}

export function openCredentialDialog() {
  const dialog = credentialDialog();
  if (!dialog || dialog.open) {
    return;
  }
  dialog.showModal();
}

export function closeCredentialDialog() {
  credentialDialog()?.close();
}
