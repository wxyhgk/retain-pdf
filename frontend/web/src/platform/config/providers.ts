export const DEFAULT_OCR_PROVIDER = "paddle";

export const OCR_PROVIDER_DEFINITIONS = [
  {
    id: "paddle",
    label: "PaddleOCR",
    description: "在线 OCR。",
    tokenField: "paddle_token",
    runtimeConfigKey: "paddleToken",
    tokenLabel: "Paddle Access Token",
    tokenPlaceholder: "Paddle Access Token",
    validationButtonLabel: "检测 Paddle",
    validationIdleMessage: "未检测",
    validationMissingMessage: "请先填写 Paddle Access Token。",
    validationUnavailableMessage: "",
    docsUrl: "https://aistudio.baidu.com/account/accessToken",
    docsLabel: "获取 Token",
    supportsValidation: true,
  },
  {
    id: "mineru",
    label: "MinerU",
    description: "MinerU 在线文档解析。",
    tokenField: "mineru_token",
    runtimeConfigKey: "mineruToken",
    tokenLabel: "MinerU API Token",
    tokenPlaceholder: "MinerU API Token",
    validationButtonLabel: "检测 MinerU",
    validationIdleMessage: "未检测",
    validationMissingMessage: "请先填写 MinerU API Token。",
    validationUnavailableMessage: "",
    docsUrl: "https://mineru.net/apiManage/docs",
    docsLabel: "获取 Token / API 文档",
    supportsValidation: true,
  },
];

export const TRANSLATION_PROVIDER_DEFINITION = {
  id: "openai-compatible",
  label: "翻译 API",
  keyLabel: "API Key",
  keyPlaceholder: "模型 API Key",
  description: "支持 OpenAI 格式与 Anthropic 格式的接口。",
  docsUrl: "https://platform.deepseek.com/api_keys",
  docsLabel: "DeepSeek Key",
  validationButtonLabel: "检测接口",
  validationIdleMessage: "未检测",
  validationMissingMessage: "请先填写翻译 API Key。",
  validationSuccessMessage: "翻译接口连接成功。",
  validationNetworkMessage: "翻译接口检测失败，请检查 API URL、Key 或网络。",
  validationUnauthorizedMessage: "翻译 API Key 无效或已过期。",
};

export const DEEPSEEK_TRANSLATION_BASE_URL = "https://api.deepseek.com/v1";
export const QWEN_TRANSLATION_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
export const ANTHROPIC_TRANSLATION_BASE_URL = "https://api.anthropic.com/v1";
export const OPENAI_TRANSLATION_BASE_URL = "https://api.openai.com/v1";
export const ZHIPU_TRANSLATION_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

export const TRANSLATION_PROVIDER_OPTIONS = [
  {
    id: "qwen",
    label: "Qwen",
    protocol: "openai",
    baseUrl: QWEN_TRANSLATION_BASE_URL,
    defaultModel: "qwen3.8-flash",
    defaultWorkers: 20,
    maxWorkers: 50,
    logoUrl: "src/assets/providers/qwen.svg",
    billingUrl: "https://platform.qianwenai.com/home/billing/overview",
    billingLabel: "Qwen 充值",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    protocol: "openai",
    baseUrl: DEEPSEEK_TRANSLATION_BASE_URL,
    defaultModel: "deepseek-flash",
    defaultWorkers: 50,
    maxWorkers: 100,
    logoUrl: "src/assets/providers/deepseek.svg",
    docsUrl: TRANSLATION_PROVIDER_DEFINITION.docsUrl,
    docsLabel: TRANSLATION_PROVIDER_DEFINITION.docsLabel,
  },
  {
    id: "anthropic",
    label: "Anthropic",
    protocol: "anthropic",
    baseUrl: ANTHROPIC_TRANSLATION_BASE_URL,
    defaultModel: "claude-sonnet-5",
    defaultWorkers: 50,
    maxWorkers: 100,
    logoUrl: "src/assets/providers/anthropic.svg",
  },
  {
    id: "openai",
    label: "OpenAI",
    protocol: "openai",
    baseUrl: OPENAI_TRANSLATION_BASE_URL,
    defaultModel: "gpt-5.6-luna",
    defaultWorkers: 50,
    maxWorkers: 100,
    logoUrl: "src/assets/providers/openai.svg",
  },
  {
    id: "zhipu",
    label: "智谱",
    protocol: "openai",
    baseUrl: ZHIPU_TRANSLATION_BASE_URL,
    defaultModel: "GLM-5.3-Flash",
    defaultWorkers: 5,
    maxWorkers: 50,
    logoUrl: "src/assets/providers/zai.svg",
    docsUrl: "https://bigmodel.cn/usercenter/proj-mgmt/apikeys",
    docsLabel: "智谱 API Key",
    billingUrl: "https://bigmodel.cn/finance-center/finance/pay",
    billingLabel: "智谱充值",
  },
  {
    id: "custom",
    label: "自定义 API",
    protocol: "openai",
    baseUrl: "",
    defaultModel: "",
    defaultWorkers: 5,
    maxWorkers: 100,
    recommendedWorkers: 5,
    logoUrl: "",
  },
];

/** 接口协议（与任务契约 translation.api_protocol 一致）。 */
export const TRANSLATION_API_PROTOCOL_OPTIONS = [
  { id: "openai", label: "OpenAI 格式", hint: "/chat/completions" },
  { id: "openai_responses", label: "OpenAI Responses 格式", hint: "/responses" },
  { id: "anthropic", label: "Anthropic 格式", hint: "/messages" },
] as const;

/** 思考深度（与任务契约 translation.thinking 一致）。auto：能关就关，翻译用不着思考。 */
export const TRANSLATION_THINKING_OPTIONS = [
  { id: "auto", label: "自动" },
  { id: "off", label: "关闭" },
  { id: "low", label: "浅" },
  { id: "medium", label: "中" },
  { id: "high", label: "深" },
  { id: "max", label: "最深" },
] as const;

export type TranslationApiProtocol = typeof TRANSLATION_API_PROTOCOL_OPTIONS[number]["id"];
export type TranslationThinking = typeof TRANSLATION_THINKING_OPTIONS[number]["id"];

export function normalizeTranslationApiProtocol(value: unknown, fallback: TranslationApiProtocol = "openai"): TranslationApiProtocol {
  const text = `${value || ""}`.trim().toLowerCase();
  return TRANSLATION_API_PROTOCOL_OPTIONS.some((option) => option.id === text) ? text as TranslationApiProtocol : fallback;
}

export function normalizeTranslationThinking(value: unknown): TranslationThinking {
  const text = `${value || ""}`.trim().toLowerCase();
  return TRANSLATION_THINKING_OPTIONS.some((option) => option.id === text) ? text as TranslationThinking : "auto";
}

export function normalizeTranslationProvider(value = "") {
  const provider = `${value || ""}`.trim().toLowerCase();
  return TRANSLATION_PROVIDER_OPTIONS.some((item) => item.id === provider) ? provider : "custom";
}

export function inferTranslationProvider(baseUrl = "") {
  const raw = `${baseUrl || ""}`.trim();
  if (!raw) return "custom";
  if (isOfficialDeepSeekBaseUrl(raw)) return "deepseek";
  try {
    const parsed = new URL(raw);
    const normalizedPath = parsed.pathname.replace(/\/+$/, "");
    if (
      parsed.hostname.toLowerCase() === "dashscope.aliyuncs.com"
      && normalizedPath === "/compatible-mode/v1"
    ) {
      return "qwen";
    }
    if (parsed.hostname.toLowerCase() === "api.anthropic.com" && normalizedPath === "/v1") {
      return "anthropic";
    }
    if (parsed.hostname.toLowerCase() === "api.openai.com" && normalizedPath === "/v1") {
      return "openai";
    }
    if (
      parsed.hostname.toLowerCase() === "open.bigmodel.cn"
      && normalizedPath === "/api/paas/v4"
    ) {
      return "zhipu";
    }
  } catch {
    // 空值和未完成输入都属于自定义接口。
  }
  return "custom";
}

export function getTranslationProviderDefinition(provider = "") {
  const normalized = normalizeTranslationProvider(provider);
  return TRANSLATION_PROVIDER_OPTIONS.find((item) => item.id === normalized)
    || TRANSLATION_PROVIDER_OPTIONS[TRANSLATION_PROVIDER_OPTIONS.length - 1];
}

export function isOfficialDeepSeekBaseUrl(value = "") {
  const raw = `${value || ""}`.trim();
  if (!raw) return true;
  try {
    return new URL(raw).hostname.toLowerCase() === "api.deepseek.com";
  } catch {
    return false;
  }
}

export function normalizeOcrProvider(value: unknown) {
  const provider = `${value || ""}`.trim().toLowerCase();
  return OCR_PROVIDER_DEFINITIONS.some((item) => item.id === provider) ? provider : DEFAULT_OCR_PROVIDER;
}

export function getOcrProviderDefinition(provider: unknown) {
  return OCR_PROVIDER_DEFINITIONS.find((item) => item.id === normalizeOcrProvider(provider)) || OCR_PROVIDER_DEFINITIONS[0];
}
