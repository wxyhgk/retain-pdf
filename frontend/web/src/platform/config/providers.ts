export const DEFAULT_OCR_PROVIDER = "paddle";

export const OCR_PROVIDER_DEFINITIONS = [
  {
    id: "paddle",
    label: "PaddleOCR",
    description: "百度飞桨在线 OCR，一本最多 999 页。",
    logoUrl: "",
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
    // 一本最多几页：后端 RUST_API_PADDLE_MAX_PAGES 的默认值，超了建任务时后端也拒。0 = 不限。
    maxPages: 999,
    // 一个文件最大多少字节，0 = 只看后端的上传上限：Paddle 由我们切成 10 页一片交（paddle_chunked.py），
    // 它自己「本地文件 ≤50MB」的限制落在每一片上，整本多大都行。
    maxBytes: 0,
  },
  {
    id: "mineru",
    label: "MinerU",
    description: "MinerU 在线文档解析，一本最多 600 页。",
    logoUrl: "",
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
    // 后端 RUST_API_MINERU_MAX_PAGES 的默认值。
    maxPages: 600,
    // MinerU 整份一次交，它的接口单个文件最大 200MB。
    maxBytes: 200 * 1024 * 1024,
  },
  {
    // 智谱的版面解析（glm-ocr），和智谱翻译模型共用一个 key。任务里没有专用的 key 字段：
    // 内联的 key 放进 ocr.options.credential（tokenField 为空、inlineOption 指明）。
    // 只收上传的本地文件；网页端本来就只交上传的文件。
    id: "glm_ocr",
    label: "GLM-OCR",
    description: "智谱版面解析，公式出 LaTeX、表格出 HTML，不限页数；和智谱翻译共用一个 key。",
    // 设置里服务商卡片上的标志（和翻译「智谱」同一个）；没有标志的用线条图标。
    logoUrl: "src/assets/providers/zai.svg",
    tokenField: "",
    inlineOption: "credential",
    runtimeConfigKey: "glmOcrToken",
    tokenLabel: "智谱 API Key",
    tokenPlaceholder: "智谱 API Key（翻译用智谱时可以不填）",
    validationButtonLabel: "",
    validationIdleMessage: "未检测",
    validationMissingMessage: "请先填写智谱 API Key；翻译用智谱时可以不填。",
    validationUnavailableMessage: "翻译选了智谱时可以不填，用翻译的同一个 key。",
    docsUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    docsLabel: "获取 Key",
    supportsValidation: false,
    // 分段识别，多长的书都行。
    maxPages: 0,
    // 同样切成 10 页一片交（glm_ocr_driver.py），它「≤50MB」的限制落在每一片上。
    maxBytes: 0,
  },
];

/** 翻译接口是智谱（open.bigmodel.cn）吗：是的话 GLM-OCR 可以不填自己的 key，后端借翻译的 key。 */
export function isZhipuBaseUrl(value: unknown): boolean {
  try {
    return new URL(`${value || ""}`.trim()).hostname.toLowerCase() === "open.bigmodel.cn";
  } catch {
    return false;
  }
}

/** 这家 OCR 不填自己的 key 也能跑吗：GLM-OCR 可以借智谱翻译的 key。
 *  保存设置时按翻译接口是不是智谱把关（save-flow）；其余「配好了没有」的判断据此放行。 */
export function ocrKeyBorrowable(provider: unknown): boolean {
  return normalizeOcrProvider(provider) === "glm_ocr";
}

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
export const OPENCODE_GO_TRANSLATION_BASE_URL = "https://opencode.ai/inference/go/v1";

export const TRANSLATION_PROVIDER_OPTIONS = [
  {
    id: "qwen",
    label: "Qwen",
    protocol: "openai_responses",
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
    protocol: "openai_responses",
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
    protocol: "openai_responses",
    baseUrl: OPENAI_TRANSLATION_BASE_URL,
    defaultModel: "gpt-5.6-luna",
    defaultWorkers: 50,
    maxWorkers: 100,
    logoUrl: "src/assets/providers/openai.svg",
  },
  {
    id: "zhipu",
    label: "智谱",
    protocol: "openai_responses",
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
    id: "opencode",
    label: "OpenCode Go",
    protocol: "openai_responses",
    baseUrl: OPENCODE_GO_TRANSLATION_BASE_URL,
    defaultModel: "deepseek-v4.1-flash",
    defaultWorkers: 5,
    maxWorkers: 100,
    logoUrl: "",
    docsUrl: "https://opencode.ai/docs/go/",
    docsLabel: "OpenCode Go 文档",
  },
  {
    id: "custom",
    label: "自定义 API",
    protocol: "openai_responses",
    baseUrl: "",
    defaultModel: "",
    defaultWorkers: 5,
    maxWorkers: 100,
    recommendedWorkers: 5,
    logoUrl: "",
  },
];

/** 接口协议（与任务契约 translation.api_protocol 一致）。
 *  2026-11-01 用户：去掉 /chat/completions，只留 OpenAI Responses（Anthropic 官方照旧走 /messages）。
 *  以前存下的 "openai" 由 normalizeTranslationApiProtocol 落到 Responses。 */
export const TRANSLATION_API_PROTOCOL_OPTIONS = [
  { id: "openai_responses", label: "OpenAI Responses 格式", hint: "/responses" },
  { id: "anthropic", label: "Anthropic 格式", hint: "/messages" },
] as const;

/** 思考深度（与任务契约 translation.thinking 一致）。默认关闭（2026-11-01 用户：默认不思考，以前默认「自动」）。
 *  auto：能关就关。 */
export const TRANSLATION_THINKING_OPTIONS = [
  { id: "off", label: "关闭" },
  { id: "auto", label: "自动" },
  { id: "low", label: "浅" },
  { id: "medium", label: "中" },
  { id: "high", label: "深" },
  { id: "max", label: "最深" },
] as const;

export type TranslationApiProtocol = typeof TRANSLATION_API_PROTOCOL_OPTIONS[number]["id"];
export type TranslationThinking = typeof TRANSLATION_THINKING_OPTIONS[number]["id"];

export function normalizeTranslationApiProtocol(value: unknown, fallback: TranslationApiProtocol = "openai_responses"): TranslationApiProtocol {
  const text = `${value || ""}`.trim().toLowerCase();
  return TRANSLATION_API_PROTOCOL_OPTIONS.some((option) => option.id === text) ? text as TranslationApiProtocol : fallback;
}

export function normalizeTranslationThinking(value: unknown): TranslationThinking {
  const text = `${value || ""}`.trim().toLowerCase();
  return TRANSLATION_THINKING_OPTIONS.some((option) => option.id === text) ? text as TranslationThinking : "off";
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
      parsed.hostname.toLowerCase() === "opencode.ai"
      && ["/inference/go/v1", "/zen/go/v1"].includes(normalizedPath.replace(/\/chat\/completions$/, ""))
    ) {
      return "opencode";
    }
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

/** 这家 OCR 一个文件最大多少字节；0 = 它自己不限（分段交），只看后端的上传上限。 */
export function ocrMaxBytes(provider: unknown): number {
  return getOcrProviderDefinition(provider).maxBytes;
}

/** 这家 OCR 一本最多几页；0 = 不限（GLM-OCR）。 */
export function ocrMaxPages(provider: unknown): number {
  return getOcrProviderDefinition(provider).maxPages;
}

export function getOcrProviderDefinition(provider: unknown) {
  return OCR_PROVIDER_DEFINITIONS.find((item) => item.id === normalizeOcrProvider(provider)) || OCR_PROVIDER_DEFINITIONS[0];
}
