import { $ } from "./dom.js";
import { applyKeyInputs, desktopInvoke, setRuntimeConfig } from "./config.js";
import { state } from "./state.js";

export function showDesktopUi() {
  $("desktop-settings-btn").classList.remove("hidden");
  $("open-output-btn").classList.remove("hidden");
}

export function setDesktopBusy(message = "") {
  const targetIds = ["desktop-setup-error"];
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
  $("desktop-setup-dialog").showModal();
}

export function closeSetupDialog() {
  if ($("desktop-setup-dialog").open) {
    $("desktop-setup-dialog").close();
  }
}

export async function bootstrapDesktop() {
  state.desktopMode = true;
  showDesktopUi();
  const payload = await desktopInvoke("load_desktop_config");
  setRuntimeConfig(payload.runtimeConfig);
  applyKeyInputs(payload.runtimeConfig.mineruToken, payload.runtimeConfig.modelApiKey);
  state.desktopConfigured = !!payload.firstRunCompleted;
  if (!state.desktopConfigured) {
    openSetupDialog();
  } else {
    closeSetupDialog();
  }
}

export async function saveDesktopConfig(mineruToken, modelApiKey, afterSave) {
  const payload = await desktopInvoke("save_desktop_config", {
    payload: {
      mineruToken,
      modelApiKey,
    },
  });
  setRuntimeConfig(payload.runtimeConfig);
  applyKeyInputs(payload.runtimeConfig.mineruToken, payload.runtimeConfig.modelApiKey);
  state.desktopConfigured = !!payload.firstRunCompleted;
  closeSetupDialog();
  $("error-box").textContent = "-";
  if (afterSave) {
    await afterSave();
  }
}
