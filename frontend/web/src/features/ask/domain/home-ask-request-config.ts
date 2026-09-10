export type HomeAskReaderAiConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export type HomeAskModelRequestOverrides = {
  llmApiKey?: string;
  llmBaseUrl?: string;
  llmModel?: string;
};

/**
 * Browser credentials are a legacy, per-request override only. When no browser
 * key exists, omit the whole override so the AI service can use runtime-config
 * credentials without an unrelated browser URL/model shadowing them.
 */
export function buildHomeAskModelRequestOverrides(
  config: HomeAskReaderAiConfig,
): HomeAskModelRequestOverrides {
  const apiKey = `${config?.apiKey || ""}`.trim();
  if (!apiKey) return {};
  return {
    llmApiKey: apiKey,
    llmBaseUrl: `${config?.baseUrl || ""}`.trim(),
    llmModel: `${config?.model || ""}`.trim(),
  };
}
