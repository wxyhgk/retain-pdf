// Shared runtime helpers — browser-aware (reads window.__FRONT_RUNTIME_CONFIG__ for apiBase / X-API-Key if present).

export const API_PREFIX = "/api/v1";
const API_V1_SUFFIX = "/api/v1";
const DEFAULT_FALLBACK_BASE = "http://127.0.0.1:41000";
const DEFAULT_FALLBACK_PORT = 41000;

export function getRuntimeConfig(): any {
  if (typeof window !== "undefined" && (window as any).__FRONT_RUNTIME_CONFIG__) return (window as any).__FRONT_RUNTIME_CONFIG__;
  return {};
}

function isFileProtocol(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "file:";
}

export function apiBase(): string {
  const cfg = getRuntimeConfig();
  if (typeof cfg.apiBase === "string" && cfg.apiBase.trim()) {
    return cfg.apiBase.trim().replace(/\/+$/, "").replace(new RegExp(`${API_V1_SUFFIX}$`), "");
  }
  if (typeof window === "undefined") return DEFAULT_FALLBACK_BASE;
  if (!isFileProtocol() && window.location.protocol === "https:") return window.location.origin;
  const host = window.location.hostname || "127.0.0.1";
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${host}:${DEFAULT_FALLBACK_PORT}`;
}

export function buildApiUrl(apiPrefix: string | undefined, relativePath: string): string {
  const normalizedPrefix = `${apiPrefix || ""}`.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  const normalizedPath = `${relativePath || ""}`.trim().replace(/^\/+/, "");
  const segments = [apiBase(), normalizedPrefix].filter(Boolean) as string[];
  if (normalizedPath) segments.push(normalizedPath);
  return segments.join("/");
}

export function frontendApiKey(): string {
  const cfg = getRuntimeConfig();
  const fromModule = typeof cfg.xApiKey === "string" ? cfg.xApiKey.trim() : "";
  if (fromModule) return fromModule;
  if (typeof window !== "undefined") {
    const live = (window as any).__FRONT_RUNTIME_CONFIG__?.xApiKey;
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
export function buildApiHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = { ...headers };
  const apiKey = frontendApiKey();
  if (apiKey) out["X-API-Key"] = apiKey;
  return out;
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
export function unwrapEnvelope<T>(envelope: any): T {
  if (envelope && typeof envelope === "object" && "data" in envelope && "code" in envelope) {
    const typed = envelope as { code: number; message?: string; data?: T };
    if (typed.code !== 0) {
      throw new Error(typed.message || `API returned code ${typed.code}`);
    }
    return (typed.data ?? null) as T;
  }
  return envelope as T;
}

// Re-export stripOcrSuffix so consumers can import from a single runtime barrel
// without needing a deep import. The source of truth lives in utils/strip-ocr.ts.
export { stripOcrSuffix } from "../utils/strip-ocr.js";
