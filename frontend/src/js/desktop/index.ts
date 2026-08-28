import { $ } from "../dom/query.js";
import {
  loadPersistedConfig,
  savePersistedDesktopConfig,
} from "../config/desktop-persistence.js";
import { savePersistedBrowserStoredConfig } from "../config/persisted-config.js";
import {
  applyDefaultCredentialInputs,
} from "../features/credentials/default-state-port.js";
import { state } from "../state/store.js";
import {
  setDesktopConfigured,
  setDesktopMode,
  setDeveloperConfig,
} from "../state/actions.js";
import { getDeveloperConfig } from "../state/developer-state.js";
import { isDesktopConfigured } from "../state/desktop-state.js";
import {
  APP_DIALOG_IDS,
  APP_EVENTS,
} from "../contracts/app-contract.js";

export function showDesktopUi() {
  $("open-output-btn").classList.remove("hidden");
}

export function setDesktopBusy(message = "") {
  const targetIds = ["browser-credentials-status"];
  for (const id of targetIds) {
    const el = $(id);
    if (!el) {
      continue;
    }
    if (message) {
      el.textContent = message;
      el.classList.remove("hidden");
    } else {
      el.textContent = "";
      el.classList.add("hidden");
    }
  }
}

export function openSetupDialog() {
  document.dispatchEvent(new CustomEvent(APP_EVENTS.openBrowserCredentials, {
    detail: { setupMode: true },
  }));
}

export function closeSetupDialog() {
  const dialog = $(APP_DIALOG_IDS.browserCredentials) as any;
  if (dialog?.open && dialog.dataset.setupMode === "1") {
    dialog.close();
  }
}

export async function bootstrapDesktop(initialConfig = null) {
  setDesktopMode(state, true);
  showDesktopUi();
  const payload = initialConfig || await loadPersistedConfig();
  setDeveloperConfig(state, payload.developerConfig || {});
  applyDefaultCredentialInputs(payload.browserConfig || {});
  setDesktopConfigured(state, payload.firstRunCompleted);
  if (!isDesktopConfigured(state)) {
    openSetupDialog();
  } else {
    closeSetupDialog();
  }
}

export async function saveDesktopConfig(browserConfig: any = {}, afterSave) {
  const source = (typeof browserConfig === "object" && browserConfig !== null) ? browserConfig : {};
  const nextBrowserConfig = { ...(source.browserConfig || source) };
  const markConfigured = !!source.markConfigured;
  const callback = afterSave;
  let persisted = await savePersistedBrowserStoredConfig({
    ...nextBrowserConfig,
  });
  setDeveloperConfig(state, persisted.developerConfig || getDeveloperConfig(state));
  applyDefaultCredentialInputs(persisted.browserConfig || {});
  if (markConfigured && !persisted.firstRunCompleted) {
    persisted = await savePersistedDesktopConfig({ firstRunCompleted: true });
    setDeveloperConfig(state, persisted.developerConfig || getDeveloperConfig(state));
    applyDefaultCredentialInputs(persisted.browserConfig || {});
  }
  setDesktopConfigured(state, persisted.firstRunCompleted);
  if (isDesktopConfigured(state)) {
    closeSetupDialog();
    const errorBox = $("error-box") || $("error-box-inline");
    if (errorBox) {
      errorBox.textContent = "-";
      errorBox.classList?.add("hidden");
    }
  }
  if (callback) {
    try {
      await callback();
    } catch (error) {
      if (isDesktopConfigured(state)) {
        const message = error?.message || String(error);
        throw new Error(`Cấu hình lần đầu đã được lưu, nhưng hiện không thể kết nối với backend cục bộ. ${message}`);
      }
      throw error;
    }
  }
  setDeveloperConfig(state, persisted.developerConfig || getDeveloperConfig(state));
  applyDefaultCredentialInputs(persisted.browserConfig || {});
  return persisted;
}
