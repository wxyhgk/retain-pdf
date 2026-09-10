import {
  isDesktopMode,
  persistedDesktopSnapshot,
  savePersistedBrowserConfig,
  savePersistedDeveloperConfig,
} from "./desktop-persistence.js";
import {
  normalizeBrowserStoredConfig,
  normalizeDeveloperStoredConfig,
  readBrowserStoredConfig,
  readDeveloperStoredConfig,
  writeBrowserStoredConfig,
  writeDeveloperStoredConfig,
} from "./storage.js";

function preferNonEmpty(primary = "", fallback = "") {
  const a = `${primary ?? ""}`.trim();
  if (a) {
    return a;
  }
  return `${fallback ?? ""}`.trim();
}

/**
 * 读取用户凭据：
 * - 浏览器：localStorage
 * - 桌面：desktop snapshot 与 localStorage shadow 合并（非空优先）
 *   避免「刚保存进 shadow / state，但 snapshot 仍是空 Key」导致 AI 门禁误锁。
 */
export function loadBrowserStoredConfig() {
  const fromStorage = normalizeBrowserStoredConfig(readBrowserStoredConfig());
  if (!isDesktopMode()) {
    return fromStorage;
  }
  const snapshot = persistedDesktopSnapshot();
  if (!snapshot?.browserConfig) {
    return fromStorage;
  }
  const fromSnap = normalizeBrowserStoredConfig(snapshot.browserConfig);
  return normalizeBrowserStoredConfig({
    ocrProvider: fromSnap.ocrProvider || fromStorage.ocrProvider,
    ocrCredentialRef: preferNonEmpty(
      fromSnap.ocrCredentialRef,
      fromStorage.ocrCredentialRef,
    ),
    paddleToken: preferNonEmpty(fromSnap.paddleToken, fromStorage.paddleToken),
    translationCredentialRef: preferNonEmpty(
      fromSnap.translationCredentialRef,
      fromStorage.translationCredentialRef,
    ),
    modelApiKey: preferNonEmpty(fromSnap.modelApiKey, fromStorage.modelApiKey),
  });
}

export function saveBrowserStoredConfig(payload = {}) {
  writeBrowserStoredConfig(payload);
}

export async function savePersistedBrowserStoredConfig(payload = {}) {
  const nextBrowserConfig = normalizeBrowserStoredConfig(payload);
  saveBrowserStoredConfig(nextBrowserConfig);
  return savePersistedBrowserConfig(nextBrowserConfig);
}

export function loadDeveloperStoredConfig() {
  const snapshot = persistedDesktopSnapshot();
  return isDesktopMode() && snapshot
    ? snapshot.developerConfig
    : normalizeDeveloperStoredConfig(readDeveloperStoredConfig());
}

export function saveDeveloperStoredConfig(payload = {}) {
  writeDeveloperStoredConfig(payload);
}

export async function savePersistedDeveloperStoredConfig(payload = {}) {
  const nextDeveloperConfig = normalizeDeveloperStoredConfig(payload);
  saveDeveloperStoredConfig(nextDeveloperConfig);
  return savePersistedDeveloperConfig(nextDeveloperConfig);
}
