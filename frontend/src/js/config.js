import { $ } from "./dom.js";
import {
  BROWSER_CONFIG_STORAGE_KEY,
  DEVELOPER_CONFIG_STORAGE_KEY,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
} from "./constants.js";

let runtimeConfig = { ...(window.__FRONT_RUNTIME_CONFIG__ || {}) };

const tauriInternals = typeof window.__TAURI_INTERNALS__ === "object" ? window.__TAURI_INTERNALS__ : null;
const desktopBridge = tauriInternals && typeof tauriInternals.invoke === "function"
  ? {
      invoke(command, args = {}) {
        return tauriInternals.invoke(command, args);
      },
    }
  : null;

export function isFileProtocol() {
  return window.location.protocol === "file:";
}

export function buildFrontendPageUrl(relativePath, params = {}) {
  const url = new URL(relativePath, window.location.href);
  for (const [key, value] of Object.entries(params || {})) {
    const normalized = `${value ?? ""}`.trim();
    if (!normalized) {
      url.searchParams.delete(key);
      continue;
    }
    url.searchParams.set(key, normalized);
  }
  return url.toString();
}

export function readerMessageTargetOrigin() {
  return isFileProtocol() ? "*" : window.location.origin;
}

export function isTrustedWindowMessage(event, expectedSource = null) {
  if (expectedSource && event.source !== expectedSource) {
    return false;
  }
  if (isFileProtocol()) {
    return event.origin === "null" || !event.origin;
  }
  return event.origin === window.location.origin;
}

export function apiBase() {
  if (typeof runtimeConfig.apiBase === "string" && runtimeConfig.apiBase.trim()) {
    return runtimeConfig.apiBase.trim().replace(/\/$/, "");
  }
  const host = window.location.hostname || "127.0.0.1";
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${host}:41000`;
}

export function mockScenario() {
  const value = new URLSearchParams(window.location.search).get("mock")?.trim().toLowerCase() || "";
  return ["queued", "running", "succeeded", "failed"].includes(value) ? value : "";
}

export function isMockMode() {
  return !!mockScenario();
}

export function frontendApiKey() {
  return typeof runtimeConfig.xApiKey === "string" ? runtimeConfig.xApiKey.trim() : "";
}

export function buildApiHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const apiKey = frontendApiKey();
  if (apiKey) {
    headers["X-API-KEY"] = apiKey;
  }
  return headers;
}

export function defaultMineruToken() {
  return typeof runtimeConfig.mineruToken === "string" ? runtimeConfig.mineruToken : "";
}

export function defaultModelApiKey() {
  return typeof runtimeConfig.modelApiKey === "string" ? runtimeConfig.modelApiKey : "";
}

export function defaultModelName() {
  return typeof runtimeConfig.model === "string" && runtimeConfig.model.trim()
    ? runtimeConfig.model.trim()
    : DEFAULT_MODEL;
}

export function defaultModelBaseUrl() {
  return typeof runtimeConfig.baseUrl === "string" && runtimeConfig.baseUrl.trim()
    ? runtimeConfig.baseUrl.trim()
    : DEFAULT_BASE_URL;
}

export function isDesktopMode() {
  return !!desktopBridge;
}

export function setRuntimeConfig(nextConfig = {}) {
  runtimeConfig = {
    ...runtimeConfig,
    ...nextConfig,
  };
}

export function loadBrowserStoredConfig() {
  if (isDesktopMode() || typeof window.localStorage === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(BROWSER_CONFIG_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch (_err) {
    return {};
  }
}

export function saveBrowserStoredConfig() {
  if (isDesktopMode() || typeof window.localStorage === "undefined") {
    return;
  }
  const payload = {
    mineruToken: $("mineru_token")?.value || "",
    modelApiKey: $("api_key")?.value || "",
  };
  try {
    window.localStorage.setItem(BROWSER_CONFIG_STORAGE_KEY, JSON.stringify(payload));
  } catch (_err) {
    // Ignore storage quota / privacy mode failures.
  }
}

export function loadDeveloperStoredConfig() {
  if (typeof window.localStorage === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(DEVELOPER_CONFIG_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch (_err) {
    return {};
  }
}

export function saveDeveloperStoredConfig(payload = {}) {
  if (typeof window.localStorage === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(DEVELOPER_CONFIG_STORAGE_KEY, JSON.stringify(payload));
  } catch (_err) {
    // Ignore storage failures.
  }
}

export function applyKeyInputs(mineruToken, modelApiKey) {
  $("mineru_token").value = mineruToken || "";
  $("api_key").value = modelApiKey || "";
  if ($("setup-mineru-token")) {
    $("setup-mineru-token").value = mineruToken || "";
  }
  if ($("setup-model-api-key")) {
    $("setup-model-api-key").value = modelApiKey || "";
  }
}

export async function desktopInvoke(command, args = {}) {
  if (!desktopBridge) {
    throw new Error("桌面接口不可用");
  }
  return desktopBridge.invoke(command, args);
}
