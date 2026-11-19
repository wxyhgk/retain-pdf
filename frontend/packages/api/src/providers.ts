// providers — pure
import { buildApiEndpoint, submitJson } from "./http.js";

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

/** 拉回来的一个模型。price 和 /usage/prices 同形状：每百万 token 的美元单价，查不到是 null。 */
export type ProviderModelPrice = {
  input: number | null;
  output: number | null;
  cache_read?: number | null;
  cache_write?: number | null;
  peak_multiplier?: number | null;
};

export type ProviderModelView = {
  id: string;
  display_name?: string | null;
  owned_by?: string | null;
  created?: number | null;
  /** chat：对话模型；other：名字看得出是 embedding、tts、图片这类，默认不列。 */
  kind: "chat" | "other";
  price_provider?: string | null;
  price_basis?: string | null;
  price?: ProviderModelPrice | null;
};

export type ProviderModelListView = {
  ok: boolean;
  /** ok / unsupported / unauthorized / invalid_input / unreachable / provider_error */
  status: string;
  summary?: string;
  base_url?: string;
  fetched_at?: string;
  provider_code?: string | number | null;
  provider_message?: string | null;
  chat_models?: number;
  models: ProviderModelView[];
};

/**
 * 从翻译接口拉模型列表（POST /providers/translation/models，后端代调服务商的 /models，key 用完不存）。
 * 服务商那边出错也是 200，看 status；没 key、地址不合规是 400。
 */
export async function fetchTranslationProviderModels(
  apiPrefix: string,
  payload: { base_url: string; api_key: string; api_protocol?: string },
): Promise<ProviderModelListView> {
  return submitJson(buildApiEndpoint(apiPrefix, "providers/translation/models"), payload, {
    timeoutMs: PROVIDER_PROBE_TIMEOUT_MS,
    timeoutMessage: "拉取模型超时（30s），请检查 API URL 与网络后重试。",
  });
}
