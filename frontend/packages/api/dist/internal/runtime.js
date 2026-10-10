// Shared runtime helpers — browser-aware (reads window.__FRONT_RUNTIME_CONFIG__ for apiBase / X-API-Key if present).
export const API_PREFIX = "/api/v1";
const API_V1_SUFFIX = "/api/v1";
const DEFAULT_FALLBACK_BASE = "http://127.0.0.1:41000";
const DEFAULT_FALLBACK_PORT = 41000;
// 与 web 侧 `platform/config/runtime.ts` 对齐：非浏览器环境（桌面/Node/SSR/构建）
// 允许由环境变量注入 apiBase / X-API-Key，优先级高于 window.__FRONT_RUNTIME_CONFIG__。
const ENV_API_BASE_NAMES = ["RETAIN_PDF_FRONTEND_API_BASE", "RETAIN_FRONTEND_API_BASE"];
const ENV_X_API_KEY_NAMES = ["RETAIN_PDF_FRONTEND_X_API_KEY", "RETAIN_FRONTEND_X_API_KEY"];
function readEnvValue(name) {
    try {
        const fromProcess = globalThis?.process?.env?.[name];
        if (typeof fromProcess === "string" && fromProcess.trim())
            return fromProcess.trim();
    }
    catch { /* 非 Node 环境忽略 */ }
    try {
        const fromImport = import.meta?.env?.[name];
        if (typeof fromImport === "string" && fromImport.trim())
            return fromImport.trim();
    }
    catch { /* 无 import.meta 环境忽略 */ }
    return "";
}
function readEnv(names) {
    for (const name of names) {
        const value = readEnvValue(name);
        if (value)
            return value;
    }
    return "";
}
function normalizeApiBase(value) {
    return value.trim().replace(/\/+$/, "").replace(new RegExp(`${API_V1_SUFFIX}$`), "");
}
export function getRuntimeConfig() {
    if (typeof window !== "undefined" && window.__FRONT_RUNTIME_CONFIG__)
        return window.__FRONT_RUNTIME_CONFIG__;
    return {};
}
function isFileProtocol() {
    if (typeof window === "undefined")
        return false;
    return window.location.protocol === "file:";
}
export function apiBase() {
    const fromEnv = readEnv(ENV_API_BASE_NAMES);
    if (fromEnv)
        return normalizeApiBase(fromEnv);
    const cfg = getRuntimeConfig();
    if (typeof cfg.apiBase === "string" && cfg.apiBase.trim()) {
        return normalizeApiBase(cfg.apiBase);
    }
    if (typeof window === "undefined")
        return DEFAULT_FALLBACK_BASE;
    if (!isFileProtocol() && window.location.protocol === "https:")
        return window.location.origin;
    const host = window.location.hostname || "127.0.0.1";
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${host}:${DEFAULT_FALLBACK_PORT}`;
}
export function buildApiUrl(apiPrefix, relativePath) {
    const normalizedPrefix = `${apiPrefix || ""}`.trim().replace(/^\/+/, "").replace(/\/+$/, "");
    const normalizedPath = `${relativePath || ""}`.trim().replace(/^\/+/, "");
    const segments = [apiBase(), normalizedPrefix].filter(Boolean);
    if (normalizedPath)
        segments.push(normalizedPath);
    return segments.join("/");
}
export function frontendApiKey() {
    const fromEnv = readEnv(ENV_X_API_KEY_NAMES);
    if (fromEnv)
        return fromEnv;
    const cfg = getRuntimeConfig();
    const fromModule = typeof cfg.xApiKey === "string" ? cfg.xApiKey.trim() : "";
    if (fromModule)
        return fromModule;
    if (typeof window !== "undefined") {
        const live = window.__FRONT_RUNTIME_CONFIG__?.xApiKey;
        return typeof live === "string" ? live.trim() : "";
    }
    return "";
}
// 不再无条件加 Content-Type。
//
// 原实现给**每一个**请求都塞 `Content-Type: application/json`，包括 GET 与
// DELETE。该头不在 CORS 安全列表里，于是每个 GET 都从 simple request 降级为
// preflighted request，多一轮 OPTIONS 往返；拉二进制产物（PDF / 缩略图）的 GET
// 也会带上语义错误的 JSON 类型。实测主页一次加载有 30 条 GET 中招。
//
// 当前后端是 CorsLayer::permissive() 所以不会失败，但前面一旦加严格反代／WAF
// （不允许 OPTIONS 或不 allow content-type），所有 GET 会直接挂。
//
// 有 body 的请求自行显式传入即可——本包 13 个带 body 的调用点里 12 个本来就
// 这么写，剩下 1 个（agent-runtime-settings 的 PUT）已一并补齐。
// 对齐 web 侧 legacy 实现 `platform/config/runtime.ts` 的同名函数。
export function buildApiHeaders(headers = {}) {
    const out = { ...headers };
    // 多用户模式靠登录 Cookie 认证，不再带部署密钥。
    const apiKey = authMode === "multi" ? "" : frontendApiKey();
    if (apiKey)
        out["X-API-Key"] = apiKey;
    return out;
}
let authMode = "single";
let unauthorizedHandler = null;
export function setApiAuthMode(mode) {
    authMode = mode === "multi" ? "multi" : "single";
}
export function getApiAuthMode() {
    return authMode;
}
/** 多用户模式下任何请求回 401（登录过期、被管理员踢下线）时调用；登录接口自己的 401 不算。 */
export function setApiUnauthorizedHandler(handler) {
    unauthorizedHandler = handler;
}
function requestUrl(input) {
    if (typeof input === "string")
        return input;
    if (input instanceof URL)
        return input.href;
    return input.url || "";
}
/** 本包所有请求都走这里：按当前模式补上 credentials，统一接住 401。 */
export async function apiFetch(input, init = {}) {
    const response = await fetch(input, authMode === "multi" ? { ...init, credentials: "include" } : init);
    if (response.status === 401 && authMode === "multi" && !/\/auth\/(login|session)(\?|$)/.test(requestUrl(input))) {
        unauthorizedHandler?.();
    }
    return response;
}
// 与 `@retainpdf/domain` 的同名实现对齐（packages/domain/src/job/core.ts）。
//
// 此前这里只判 `"data" in envelope`，比 domain 版少两件事：
//   1. 不检查 `code`：HTTP 200 + `{code: 40001, message, data: null}` 会被静默
//      解包成 null，上层当「查到 0 条」渲染成空态，后端的错误原文丢失。
//      当前 Rust 侧 ApiResponse::ok 恒为 code: 0、错误一律走非 2xx，所以尚未
//      触发——但这是一道被移除的防线，任何把业务错误降级成 200 的后端改动
//      都会变成「静默空数据」。
//   2. 不要求 `code` 存在：对**未包 envelope 却恰好有顶层 data 字段**的 2xx
//      JSON 会误解包一层。
export function unwrapEnvelope(envelope) {
    if (envelope && typeof envelope === "object" && "data" in envelope && "code" in envelope) {
        const typed = envelope;
        if (typed.code !== 0) {
            throw new Error(typed.message || `API returned code ${typed.code}`);
        }
        return (typed.data ?? null);
    }
    return envelope;
}
// Re-export stripOcrSuffix so consumers can import from a single runtime barrel
// without needing a deep import. The source of truth lives in utils/strip-ocr.ts.
export { stripOcrSuffix } from "../utils/strip-ocr.js";
