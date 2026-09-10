import { DEFAULT_BASE_URL, DEFAULT_MODEL } from "./model-constants.js";
import { normalizeOcrProvider } from "./providers.js";

export const DEFAULT_FALLBACK_BASE = "http://127.0.0.1:41000";
const DEFAULT_FALLBACK_PORT = 41000;

// apiBase / xApiKey 解析优先级（高→低）：
//   1. env（构建/桌面注入：RETAIN_PDF_FRONTEND_*，兼容 RETAIN_FRONTEND_*）
//   2. window.__FRONT_RUNTIME_CONFIG__（先模块快照，再 live 回读，覆盖 local 晚注入）
//   3. 同 host 回退（https 取 origin，其余取同 host:41000）
const ENV_API_BASE_NAMES = ["RETAIN_PDF_FRONTEND_API_BASE", "RETAIN_FRONTEND_API_BASE"];
const ENV_X_API_KEY_NAMES = ["RETAIN_PDF_FRONTEND_X_API_KEY", "RETAIN_FRONTEND_X_API_KEY"];

function readNodeEnv(name: string): string {
  try {
    const value = (globalThis as any)?.process?.env?.[name];
    return typeof value === "string" ? value.trim() : "";
  } catch {
    return "";
  }
}

function readImportMetaEnv(name: string): string {
  try {
    const value = (import.meta as any)?.env?.[name];
    return typeof value === "string" ? value.trim() : "";
  } catch {
    return "";
  }
}

function readEnv(names: string[]): string {
  for (const name of names) {
    const value = readNodeEnv(name) || readImportMetaEnv(name);
    if (value) {
      return value;
    }
  }
  return "";
}

function normalizeApiBase(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  return value.trim().replace(/\/+$/, "").replace(new RegExp(`${API_V1_SUFFIX}$`), "");
}

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
  const fromEnv = normalizeApiBase(readEnv(ENV_API_BASE_NAMES));
  if (fromEnv) {
    return fromEnv;
  }
  const fromSnapshot = normalizeApiBase((runtimeConfig as any)?.apiBase);
  if (fromSnapshot) {
    return fromSnapshot;
  }
  // runtime-config.local.js 晚注入时模块快照可能为空，再读一次 live window。
  const fromLive = normalizeApiBase(liveRuntimeString("apiBase"));
  if (fromLive) {
    return fromLive;
  }
  if (typeof window === "undefined") {
    return DEFAULT_FALLBACK_BASE;
  }
  if (!isFileProtocol() && window.location.protocol === "https:") {
    return window.location.origin;
  }
  const host = window.location.hostname || "127.0.0.1";
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${host}:${DEFAULT_FALLBACK_PORT}`;
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
  // 同文件的 apiBase() 有这道防御，这里原先没有：任何非浏览器环境（node --test、
  // SSR、构建脚本）只要走到 isMockMode() 就会 ReferenceError。
  // 书架封面加载改走 mock-aware 网关后，这条路径第一次在 node 测试里被触达。
  if (typeof window === "undefined") return "";
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

/** 模块快照为空时再读一次 window（runtime-config.local.js 晚注入等边缘情况）。 */
function liveRuntimeString(key: string): string {
  if (typeof window === "undefined") {
    return "";
  }
  const cfg = (window as any).__FRONT_RUNTIME_CONFIG__;
  const value = cfg?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export function frontendApiKey() {
  const fromEnv = readEnv(ENV_X_API_KEY_NAMES);
  if (fromEnv) {
    return fromEnv;
  }
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
  // 两把钥匙之一：下游 LLM（DeepSeek 等）的 Bearer key，随 ask 请求 body.llm_api_key 上传。
  // 勿与 xApiKey（Rust/AI 服务 X-API-Key）混淆。
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
