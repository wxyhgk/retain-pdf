// 厂商和模型的标志：文件在哪、是不是单色、按模型名 / 接口地址认出是哪家。
//
// 文件：src/assets/providers/（厂商）、src/assets/models/（模型）。大部分来自 LobeHub Icons（@lobehub/icons-static-svg，
// MIT），MinerU 取自它的官方仓库，飞桨取自 Simple Icons（CC0）；2026-11-12 收进来。图形是各公司的商标，只用来标明
// 「这是哪家的服务 / 模型」。
//
// mono：官方标志本身是单色的（OpenAI、Anthropic、xAI……）。当普通图片放会是固定的黑色，暗色主题下看不见，
// 所以 BrandLogo 组件对它们用 CSS mask 画成当前文字颜色；彩色的照原样显示。

export type BrandLogo = {
  /** 相对页面的地址（三个页面都在 frontend/web 根下）。 */
  src: string;
  /** 单色标志：跟着文字颜色走。 */
  mono: boolean;
  /** 给悬停和读屏的名字。 */
  name: string;
};

function vendor(file: string, name: string, mono = false): BrandLogo {
  return { src: `src/assets/providers/${file}.svg`, mono, name };
}

function model(file: string, name: string, mono = false): BrandLogo {
  return { src: `src/assets/models/${file}.svg`, mono, name };
}

/** 厂商（接口服务商、OCR 服务商）。 */
export const VENDOR_LOGOS = {
  alibabacloud: vendor("alibabacloud", "阿里云"),
  anthropic: vendor("anthropic", "Anthropic", true),
  azure: vendor("azure", "Azure"),
  baidu: vendor("baidu", "百度"),
  baiducloud: vendor("baiducloud", "百度智能云"),
  bailian: vendor("bailian", "阿里云百炼"),
  bedrock: vendor("bedrock", "AWS Bedrock"),
  bytedance: vendor("bytedance", "字节跳动"),
  cohere: vendor("cohere", "Cohere"),
  deepseek: vendor("deepseek", "DeepSeek"),
  fireworks: vendor("fireworks", "Fireworks"),
  google: vendor("google", "Google"),
  groq: vendor("groq", "Groq", true),
  huggingface: vendor("huggingface", "Hugging Face"),
  iflytekcloud: vendor("iflytekcloud", "讯飞开放平台"),
  meta: vendor("meta", "Meta"),
  mineru: vendor("mineru", "MinerU", true),
  minimax: vendor("minimax", "MiniMax"),
  mistral: vendor("mistral", "Mistral"),
  moonshot: vendor("moonshot", "月之暗面", true),
  nvidia: vendor("nvidia", "NVIDIA"),
  ollama: vendor("ollama", "Ollama", true),
  openai: vendor("openai", "OpenAI", true),
  opencode: vendor("opencode", "OpenCode", true),
  openrouter: vendor("openrouter", "OpenRouter"),
  paddlepaddle: vendor("paddlepaddle", "飞桨", true),
  sensenova: vendor("sensenova", "商汤日日新"),
  siliconcloud: vendor("siliconcloud", "硅基流动"),
  stepfun: vendor("stepfun", "阶跃星辰"),
  tencent: vendor("tencent", "腾讯"),
  tencentcloud: vendor("tencentcloud", "腾讯云"),
  together: vendor("together", "Together AI"),
  volcengine: vendor("volcengine", "火山引擎"),
  xai: vendor("xai", "xAI", true),
  zai: vendor("zai", "Z.ai", true),
  zeroone: vendor("zeroone", "零一万物", true),
  zhipu: vendor("zhipu", "智谱"),
} as const satisfies Record<string, BrandLogo>;

/** 模型家族。 */
export const MODEL_LOGOS = {
  claude: model("claude", "Claude"),
  deepseek: model("deepseek", "DeepSeek"),
  doubao: model("doubao", "豆包"),
  ernie: model("ernie", "文心"),
  gemini: model("gemini", "Gemini"),
  glm: model("glm", "GLM"),
  gpt: model("gpt", "GPT", true),
  grok: model("grok", "Grok", true),
  hunyuan: model("hunyuan", "混元"),
  internlm: model("internlm", "书生"),
  kimi: model("kimi", "Kimi", true),
  llama: model("llama", "Llama"),
  minimax: model("minimax", "MiniMax"),
  mistral: model("mistral", "Mistral"),
  qwen: model("qwen", "通义千问"),
  spark: model("spark", "讯飞星火"),
  step: model("step", "Step"),
  yi: model("yi", "Yi", true),
} as const satisfies Record<string, BrandLogo>;

export type VendorLogoKey = keyof typeof VENDOR_LOGOS;
export type ModelLogoKey = keyof typeof MODEL_LOGOS;

/** 按模型名认家族：先认更具体的（qwq 归通义、codestral 归 Mistral），认不出返回 null。 */
const MODEL_PATTERNS: ReadonlyArray<[RegExp, ModelLogoKey]> = [
  [/claude|anthropic/, "claude"],
  [/deepseek/, "deepseek"],
  [/qwen|qwq|qvq|tongyi/, "qwen"],
  [/glm|chatglm|zhipu|bigmodel/, "glm"],
  [/kimi|moonshot/, "kimi"],
  [/gemini|gemma/, "gemini"],
  [/grok/, "grok"],
  [/doubao|skylark/, "doubao"],
  [/ernie|wenxin/, "ernie"],
  [/hunyuan/, "hunyuan"],
  [/minimax|abab/, "minimax"],
  [/mistral|mixtral|codestral|ministral|magistral|devstral/, "mistral"],
  [/llama/, "llama"],
  [/internlm|intern-s/, "internlm"],
  [/spark|xinghuo/, "spark"],
  [/(^|[^a-z])step-/, "step"],
  [/(^|[^a-z])yi-/, "yi"],
  // GPT 放最后：o1/o3/o4 这类短名只在开头认，别把别家名字里的 o3 认成 OpenAI。
  [/gpt|openai|chatgpt|^o\d(\b|-)/, "gpt"],
];

export function modelLogoFor(modelName: string | null | undefined): BrandLogo | null {
  const name = `${modelName || ""}`.trim().toLowerCase();
  if (!name) return null;
  // 路由前缀（openrouter 的 anthropic/claude-…、硅基流动的 Qwen/Qwen3-…）也算：整串一起认。
  for (const [pattern, key] of MODEL_PATTERNS) {
    if (pattern.test(name)) return MODEL_LOGOS[key];
  }
  return null;
}

/** 按接口地址的主机名认厂商（自定义接口填了哪家的地址，就显示哪家）。后缀匹配：子域名也算。 */
const HOST_VENDORS: ReadonlyArray<[string, VendorLogoKey]> = [
  ["api.openai.com", "openai"],
  ["openai.azure.com", "azure"],
  ["cognitiveservices.azure.com", "azure"],
  ["api.anthropic.com", "anthropic"],
  ["generativelanguage.googleapis.com", "google"],
  ["aiplatform.googleapis.com", "google"],
  ["api.deepseek.com", "deepseek"],
  ["dashscope.aliyuncs.com", "bailian"],
  ["dashscope-intl.aliyuncs.com", "bailian"],
  ["open.bigmodel.cn", "zhipu"],
  ["api.z.ai", "zai"],
  ["api.moonshot.cn", "moonshot"],
  ["api.moonshot.ai", "moonshot"],
  ["qianfan.baidubce.com", "baiducloud"],
  ["aip.baidubce.com", "baiducloud"],
  ["volces.com", "volcengine"],
  ["hunyuan.cloud.tencent.com", "tencentcloud"],
  ["tencentcloudapi.com", "tencentcloud"],
  ["minimaxi.com", "minimax"],
  ["minimax.io", "minimax"],
  ["minimax.chat", "minimax"],
  ["lingyiwanwu.com", "zeroone"],
  ["stepfun.com", "stepfun"],
  ["api.x.ai", "xai"],
  ["api.mistral.ai", "mistral"],
  ["api.cohere.com", "cohere"],
  ["api.cohere.ai", "cohere"],
  ["siliconflow.cn", "siliconcloud"],
  ["siliconflow.com", "siliconcloud"],
  ["openrouter.ai", "openrouter"],
  ["api.groq.com", "groq"],
  ["amazonaws.com", "bedrock"],
  ["integrate.api.nvidia.com", "nvidia"],
  ["huggingface.co", "huggingface"],
  ["api.together.xyz", "together"],
  ["api.together.ai", "together"],
  ["api.fireworks.ai", "fireworks"],
  ["opencode.ai", "opencode"],
  ["xf-yun.com", "iflytekcloud"],
  ["sensenova.cn", "sensenova"],
];

export function vendorLogoForBaseUrl(baseUrl: string | null | undefined): BrandLogo | null {
  const raw = `${baseUrl || ""}`.trim();
  if (!raw) return null;
  let host = "";
  let port = "";
  try {
    const parsed = new URL(raw);
    host = parsed.hostname.toLowerCase();
    port = parsed.port;
  } catch {
    return null;
  }
  // 本机 11434 是 Ollama 的默认端口。
  if ((host === "localhost" || host === "127.0.0.1") && port === "11434") return VENDOR_LOGOS.ollama;
  for (const [suffix, key] of HOST_VENDORS) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return VENDOR_LOGOS[key];
  }
  return null;
}
