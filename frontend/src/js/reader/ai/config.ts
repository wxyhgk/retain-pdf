import {
  defaultModelBaseUrl,
  defaultModelName,
} from "../../config/runtime.js";
import {
  loadBrowserStoredConfig,
  loadDeveloperStoredConfig,
} from "../../config/persisted-config.js";
import { defaultCredentialsStatePort } from "../../features/credentials/default-state-port.js";

/** Return the first non-empty string after trim; blank strings are not valid credentials. */
function firstNonEmpty(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    const value = `${candidate ?? ""}`.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

/**
 * Read the model API Key from Settings -> API Settings.
 * Priority: in-memory credentials state, then persisted config (desktop snapshot/localStorage).
 * Never read runtime-config secrets.
 */
export function readSettingsModelApiKey(
  browserConfig = loadBrowserStoredConfig(),
): string {
  try {
    const live = defaultCredentialsStatePort.getCredentials?.()?.modelApiKey;
    const fromLive = `${live ?? ""}`.trim();
    if (fromLive) {
      return fromLive;
    }
  } catch {
    /* ignore */
  }
  return `${browserConfig?.modelApiKey ?? ""}`.trim();
}

export function resolveReaderAiConfig({
  browserConfig = loadBrowserStoredConfig(),
  developerConfig = loadDeveloperStoredConfig(),
} = {}) {
  // Model Key: user settings only; baseUrl/model may fall back to runtime defaults, which are not secrets.
  return {
    apiKey: readSettingsModelApiKey(browserConfig),
    baseUrl: firstNonEmpty(developerConfig?.baseUrl, defaultModelBaseUrl()),
    model: firstNonEmpty(developerConfig?.model, defaultModelName()),
    provider: "deepseek",
  };
}

/** Whether the downstream model API Key is configured in settings, used as the chat preflight gate. */
export function hasModelApiKey(): boolean {
  return Boolean(readSettingsModelApiKey());
}

/** Dispatched after credentials are saved so the AI input gate refreshes immediately. */
export const CREDENTIALS_CHANGED_EVENT = "retainpdf:credentials-changed";

export function notifyCredentialsChanged(): void {
  try {
    document.dispatchEvent(new CustomEvent(CREDENTIALS_CHANGED_EVENT));
  } catch {
    /* ignore non-DOM env */
  }
}

export const MISSING_MODEL_API_KEY_MESSAGE =
  "Thiếu model API Key: vào Cài đặt -> Cài đặt API để nhập key model như DeepSeek (không phải backend X-API-Key).";
