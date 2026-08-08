import {
  isDesktopMode,
  persistedDesktopSnapshot,
  savePersistedBrowserConfig,
  savePersistedDeveloperConfig,
} from "./desktop-persistence.js";
import {
  isObject,
  normalizeBrowserStoredConfig,
  normalizeDeveloperStoredConfig,
  readBrowserStoredConfig,
  readDeveloperStoredConfig,
  writeBrowserStoredConfig,
  writeDeveloperStoredConfig,
} from "./storage.js";
import { defaultOcrProvider } from "./runtime.js";

function preferNonEmpty(primary = "", fallback = "") {
  const a = `${primary ?? ""}`.trim();
  if (a) {
    return a;
  }
  return `${fallback ?? ""}`.trim();
}

/**
 * 原始存储载荷里是否真的写过 ocrProvider 这把 Key——区分「用户/桌面 snapshot
 * 显式选过（哪怕是 "paddle"）」与「从未保存过任何东西」，只有后者才该回退到
 * FRONT_OCR_PROVIDER 环境默认值，否则 normalizeBrowserStoredConfig 的
 * normalizeOcrProvider() 会静默把 undefined 兜成硬编码 DEFAULT_OCR_PROVIDER，
 * 环境变量默认值永远读不到。
 */
function hasStoredOcrProvider(rawPayload: unknown): boolean {
  return isObject(rawPayload) && Object.prototype.hasOwnProperty.call(rawPayload, "ocrProvider");
}

/**
 * 读取用户凭据：
 * - 浏览器：localStorage
 * - 桌面：desktop snapshot 与 localStorage shadow 合并（非空优先）
 *   避免「刚保存进 shadow / state，但 snapshot 仍是空 Key」导致 AI 门禁误锁。
 */
export function loadBrowserStoredConfig() {
  const rawStorage = readBrowserStoredConfig();
  const fromStorage = normalizeBrowserStoredConfig(rawStorage);
  if (!hasStoredOcrProvider(rawStorage)) {
    fromStorage.ocrProvider = defaultOcrProvider();
  }
  if (!isDesktopMode()) {
    return fromStorage;
  }
  const snapshot = persistedDesktopSnapshot();
  if (!snapshot?.browserConfig) {
    return fromStorage;
  }
  const rawSnap = snapshot.browserConfig;
  const fromSnap = normalizeBrowserStoredConfig(rawSnap);
  return normalizeBrowserStoredConfig({
    ocrProvider: hasStoredOcrProvider(rawSnap) ? fromSnap.ocrProvider : fromStorage.ocrProvider,
    paddleToken: preferNonEmpty(fromSnap.paddleToken, fromStorage.paddleToken),
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
