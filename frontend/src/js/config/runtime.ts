import { DEFAULT_BASE_URL, DEFAULT_MODEL } from "./model-constants.js";
import { normalizeOcrProvider } from "./providers.js";

export let runtimeConfig = {
  ...((typeof window !== "undefined" ? (window as any).__FRONT_RUNTIME_CONFIG__ : null) || {}),
};

const API_V1_SUFFIX = "/api/v1";

export function isFileProtocol() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.location.protocol === "file:";
}

export function buildFrontendPageUrl(relativePath, params = {}) {
  const baseHref = typeof window !== "undefined" && window.location?.href
    ? window.location.href
    : "http://127.0.0.1/";
  const url = new URL(relativePath, baseHref);
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
  if (typeof window === "undefined") {
    return "*";
  }
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
    return runtimeConfig.apiBase.trim().replace(/\/+$/, "").replace(new RegExp(`${API_V1_SUFFIX}$`), "");
  }
  if (typeof window === "undefined") {
    return "http://127.0.0.1:41000";
  }
  if (!isFileProtocol() && window.location.protocol === "https:") {
    return window.location.origin;
  }
  const host = window.location.hostname || "127.0.0.1";
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${host}:41000`;
}

export function buildApiUrl(apiPrefix = "", relativePath = "") {
  const normalizedPrefix = `${apiPrefix || ""}`.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  const normalizedPath = `${relativePath || ""}`.trim().replace(/^\/+/, "");
  const segments = [apiBase(), normalizedPrefix].filter(Boolean);
  if (normalizedPath) {
    segments.push(normalizedPath);
  }
  return segments.join("/");
}

export function mockScenario() {
  const value = new URLSearchParams(window.location.search).get("mock")?.trim().toLowerCase() || "";
  return [
    "queued",
    "running",
    "succeeded",
    "failed",
    "upload",
    "ocr",
    "translate",
    "render",
    "done",
    "parallel",
    "demo",
    "live",
  ].includes(value)
    ? value
    : "";
}

export function isMockMode() {
  return !!mockScenario();
}

/** Đọc lại window một lần nữa khi snapshot module trống (các trường hợp biên như runtime-config.local.js được inject muộn). */
function liveRuntimeString(key: string): string {
  if (typeof window === "undefined") {
    return "";
  }
  const cfg = (window as any).__FRONT_RUNTIME_CONFIG__;
  const value = cfg?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export function frontendApiKey() {
  const fromModule = typeof runtimeConfig.xApiKey === "string" ? runtimeConfig.xApiKey.trim() : "";
  return fromModule || liveRuntimeString("xApiKey");
}

export function buildApiHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const apiKey = frontendApiKey();
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  return headers;
}

export function defaultPaddleToken() {
  return typeof runtimeConfig.paddleToken === "string" ? runtimeConfig.paddleToken : "";
}

export function defaultPaddleApiUrl() {
  return typeof runtimeConfig.paddleApiUrl === "string" ? runtimeConfig.paddleApiUrl.trim() : "";
}

export function defaultOcrProvider() {
  return normalizeOcrProvider(runtimeConfig.ocrProvider);
}

export function defaultModelApiKey() {
  // Một trong hai khóa: Bearer key của LLM downstream (DeepSeek, v.v.) được tải lên cùng yêu cầu ask body.llm_api_key.
  // Đừng nhầm lẫn với xApiKey (Rust/AI service X-API-Key).
  const fromModule = typeof runtimeConfig.modelApiKey === "string" ? runtimeConfig.modelApiKey.trim() : "";
  return fromModule || liveRuntimeString("modelApiKey");
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

export function setRuntimeConfig(nextConfig = {}) {
  runtimeConfig = {
    ...runtimeConfig,
    ...nextConfig,
  };
}
