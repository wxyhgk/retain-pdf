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
];

export const TRANSLATION_PROVIDER_DEFINITION = {
  id: "openai-compatible",
  label: "翻译 API",
  keyLabel: "API Key",
  keyPlaceholder: "模型 API Key",
  description: "支持 DeepSeek 及 OpenAI 兼容接口。",
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
    baseUrl: DEEPSEEK_TRANSLATION_BASE_URL,
    defaultModel: "deepseek-v4-flash",
    defaultWorkers: 50,
    maxWorkers: 100,
    logoUrl: "src/assets/providers/deepseek.svg",
    docsUrl: TRANSLATION_PROVIDER_DEFINITION.docsUrl,
    docsLabel: TRANSLATION_PROVIDER_DEFINITION.docsLabel,
  },
  {
    id: "anthropic",
    label: "Anthropic",
    baseUrl: ANTHROPIC_TRANSLATION_BASE_URL,
    defaultModel: "claude-sonnet-5",
    defaultWorkers: 50,
    maxWorkers: 100,
    logoUrl: "src/assets/providers/anthropic.svg",
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: OPENAI_TRANSLATION_BASE_URL,
    defaultModel: "gpt-5.6-luna",
    defaultWorkers: 50,
    maxWorkers: 100,
    logoUrl: "src/assets/providers/openai.svg",
  },
  {
    id: "zhipu",
    label: "智谱",
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
    baseUrl: "",
    defaultModel: "",
    defaultWorkers: 5,
    maxWorkers: 100,
    recommendedWorkers: 5,
    logoUrl: "",
  },
];

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

export function normalizeOcrProvider(value) {
  const provider = `${value || ""}`.trim().toLowerCase();
  return OCR_PROVIDER_DEFINITIONS.some((item) => item.id === provider) ? provider : DEFAULT_OCR_PROVIDER;
}

export function getOcrProviderDefinition(provider) {
  return OCR_PROVIDER_DEFINITIONS.find((item) => item.id === normalizeOcrProvider(provider)) || OCR_PROVIDER_DEFINITIONS[0];
}
