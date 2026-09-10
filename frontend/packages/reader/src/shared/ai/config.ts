// 共享真值（原 frontend/web/src/js/reader/ai/config.ts），已抽离为可注入依赖
// 不直接 import frontend/web 的 runtime/persisted-config/credentials，改为参数注入，默认用空实现

function firstNonEmpty(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    const value = `${candidate ?? ""}`.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

// —— 可注入适配器（由宿主在启动时或 frontend/web/shared/ai 代理层注入） ——
type CredentialsPort = { getCredentials?: () => { modelApiKey?: string } | null };

let _credentialsPort: CredentialsPort | null = null;
let _loadBrowserStoredConfig: () => { modelApiKey?: string } | null = () => null;
let _loadDeveloperStoredConfig: () => { baseUrl?: string; model?: string } | null = () => null;
let _defaultModelBaseUrl: () => string = () => "";
let _defaultModelName: () => string = () => "";

export function setReaderAiConfigAdapters(adapters: {
  credentialsPort?: CredentialsPort | null;
  loadBrowserStoredConfig?: () => any;
  loadDeveloperStoredConfig?: () => any;
  defaultModelBaseUrl?: () => string;
  defaultModelName?: () => string;
} = {}): void {
  if ("credentialsPort" in adapters) _credentialsPort = adapters.credentialsPort ?? null;
  if (adapters.loadBrowserStoredConfig) _loadBrowserStoredConfig = adapters.loadBrowserStoredConfig;
  if (adapters.loadDeveloperStoredConfig) _loadDeveloperStoredConfig = adapters.loadDeveloperStoredConfig;
  if (adapters.defaultModelBaseUrl) _defaultModelBaseUrl = adapters.defaultModelBaseUrl;
  if (adapters.defaultModelName) _defaultModelName = adapters.defaultModelName;
}

export function resetReaderAiConfigAdapters(): void {
  _credentialsPort = null;
  _loadBrowserStoredConfig = () => null;
  _loadDeveloperStoredConfig = () => null;
  _defaultModelBaseUrl = () => "";
  _defaultModelName = () => "";
}

/** 取第一个 trim 后非空的字符串；空白 / 空串不算有效凭据。 */

/**
 * 读取「设置 → API 设置」里的模型 API Key。
 * 优先级：内存 credentials 状态 → 持久化配置（桌面 snapshot / localStorage）。
 * 不读 runtime-config 密钥。
 */
export function readSettingsModelApiKey(
  browserConfig: any = _loadBrowserStoredConfig(),
): string {
  try {
    const live = _credentialsPort?.getCredentials?.()?.modelApiKey;
    const fromLive = `${live ?? ""}`.trim();
    if (fromLive) {
      return fromLive;
    }
  } catch {
    /* ignore */
  }
  return `${browserConfig?.modelApiKey ?? ""}`.trim();
}

export function resolveReaderAiConfig({
  browserConfig = _loadBrowserStoredConfig(),
  developerConfig = _loadDeveloperStoredConfig(),
}: { browserConfig?: any; developerConfig?: any } = {}): { apiKey: string; baseUrl: string; model: string; provider: string } {
  // 模型 Key：仅用户设置；baseUrl / model 可回退 runtime 默认（非密钥）
  return {
    apiKey: readSettingsModelApiKey(browserConfig),
    baseUrl: firstNonEmpty(developerConfig?.baseUrl, _defaultModelBaseUrl()),
    model: firstNonEmpty(developerConfig?.model, _defaultModelName()),
    provider: "deepseek",
  };
}

/** 是否已在设置中配置下游模型 API Key（对话前置门禁）。 */
export function hasModelApiKey(browserConfig?: any): boolean {
  if (browserConfig !== undefined) {
    return Boolean(readSettingsModelApiKey(browserConfig));
  }
  return Boolean(readSettingsModelApiKey());
}

/** 凭据保存后派发，供 AI 输入门禁立刻刷新。 */
export const CREDENTIALS_CHANGED_EVENT = "retainpdf:credentials-changed";

export function notifyCredentialsChanged(): void {
  try {
    (globalThis as any).document?.dispatchEvent(new CustomEvent(CREDENTIALS_CHANGED_EVENT));
  } catch {
    /* ignore non-DOM env */
  }
}

export const MISSING_MODEL_API_KEY_MESSAGE =
  "缺少模型 API Key：请到设置 → API 设置填写 DeepSeek 等模型 Key（不是后端 X-API-Key）。";
