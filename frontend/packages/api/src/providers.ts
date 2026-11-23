// providers — pure
import { buildApiEndpoint, submitJson } from "./http.js";
import type { TranslationModelListView, TranslationModelsRequest } from "@retainpdf/contracts/translation-providers";
import * as providers from "./generated/translation-providers.js";
import * as errorCodes from "./generated/provider-error-codes.js";
import { serverMessageOr, type RequestOptions } from "./request.js";

// 凭据检测都是"用户点了按钮在等结果"的前台请求，必须有上限：后端探针自身
// 超时 20s（RUST_API_DEEPSEEK_PROBE_TIMEOUT_SECS），这里留 10s 余量兜住
// 后端处理与网络往返。没有它，对端挂起就会让面板的检测按钮永久停在"检测中"。
const PROVIDER_PROBE_TIMEOUT_MS = 30_000;
const PROBE_TIMEOUT_MESSAGE = "检测超时（30s），请检查 API URL 与网络后重试。";

const probeOptions = {
  timeoutMs: PROVIDER_PROBE_TIMEOUT_MS,
  timeoutMessage: PROBE_TIMEOUT_MESSAGE,
};

export async function validateMineruToken(apiPrefix: string, payload: { mineru_token: string }): Promise<any> {
  return submitJson(buildApiEndpoint(apiPrefix, "providers/mineru/validate-token"), payload, probeOptions);
}

export async function validatePaddleToken(apiPrefix: string, payload: unknown): Promise<any> {
  return submitJson(buildApiEndpoint(apiPrefix, "providers/paddle/validate-token"), payload, probeOptions);
}

export async function validateDeepSeekToken(apiPrefix: string, payload: unknown): Promise<any> {
  return submitJson(buildApiEndpoint(apiPrefix, "providers/deepseek/validate-token"), payload, probeOptions);
}

export async function queryDeepSeekBalance(apiPrefix: string, payload: unknown): Promise<any> {
  return submitJson(buildApiEndpoint(apiPrefix, "providers/deepseek/balance"), payload, probeOptions);
}

export type {
  TranslationModelListView as ProviderModelListView,
  TranslationModelView as ProviderModelView,
} from "@retainpdf/contracts/translation-providers";

/**
 * 从翻译接口拉模型列表（POST /providers/translation/models，契约 translation-providers.v1；后端代调服务商的 /models，
 * key 用完不存）。服务商那边出错也是 200，看 status；没 key、地址不合规是 400。和检测一样最多等 30 秒。
 */
export async function fetchTranslationProviderModels(
  apiPrefix: string,
  payload: { base_url: string; api_key: string; api_protocol?: string },
): Promise<TranslationModelListView> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_PROBE_TIMEOUT_MS);
  try {
    return await providers.listTranslationProviderModels(apiPrefix, { body: payload as TranslationModelsRequest }, {
      signal: controller.signal,
      onError: serverMessageOr("拉取模型失败，请稍后重试。"),
    });
  } catch (cause) {
    if (controller.signal.aborted) throw new Error("拉取模型超时（30s），请检查 API URL 与网络后重试。");
    throw cause;
  } finally {
    clearTimeout(timer);
  }
}

/** 服务商错误码目录里的一条，给失败卡片显示「这家服务商说的是什么、该怎么办」。 */
export type ProviderErrorHint = {
  /** 厂商编号（paddle、glm_ocr、openai……）和显示名。 */
  vendor: string;
  vendorLabel: string;
  /** 厂商的业务码；只按状态码对上的是空串。 */
  code: string;
  /** 官方说法（中文）和给用户的提示。 */
  meaning: string;
  hint: string;
  sourceUrl: string;
};

/**
 * 查一条服务商错误码的提示（GET /providers/error-codes，契约 provider-error-codes.v1）。
 * vendor 是目录里的厂商编号；有业务码按码精确查，只有 HTTP 状态码时只认唯一的一条——同一个 429
 * 可能是限流也可能是欠费，猜错比不说更糟。查不到返回 null。
 */
export async function fetchProviderErrorHint(
  apiPrefix: string | undefined,
  target: { vendor?: string; code?: string; httpStatus?: number | null },
  options?: RequestOptions,
): Promise<ProviderErrorHint | null> {
  const vendor = `${target.vendor || ""}`.trim();
  const code = `${target.code || ""}`.trim();
  const httpStatus = Number(target.httpStatus) || 0;
  if (!vendor || (!code && !httpStatus)) return null;
  const view = await errorCodes.listProviderErrorCodes(apiPrefix, {
    query: code ? { provider: vendor, code } : { provider: vendor, http_status: httpStatus },
  }, options);
  const found = view.vendors?.find((item) => item.id === vendor);
  const entries = found?.entries || [];
  const entry = code ? entries[0] : entries.length === 1 ? entries[0] : undefined;
  if (!found || !entry || !entry.user_hint_zh) return null;
  return {
    vendor,
    vendorLabel: found.label || vendor,
    code: entry.code || "",
    meaning: entry.meaning_zh || "",
    hint: entry.user_hint_zh,
    sourceUrl: entry.source_url || "",
  };
}
