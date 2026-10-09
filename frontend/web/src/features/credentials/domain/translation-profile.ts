// 翻译凭据 profile 的纯逻辑：默认值、归一化与校验文案。

import {
  getTranslationProviderDefinition,
} from "@/platform/config/providers.js";

export type TranslationProfile = {
  apiKey: string;
  baseUrl: string;
  model: string;
  workers: number;
};

export function translationConfigError(baseUrl = "", model = "") {
  const normalizedBaseUrl = `${baseUrl || ""}`.trim();
  if (!normalizedBaseUrl) return "请填写翻译 API URL";
  try {
    const parsed = new URL(normalizedBaseUrl);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.host) {
      return "翻译 API URL 必须是有效的 http(s) 地址";
    }
    if (parsed.username || parsed.password) {
      return "翻译 API URL 不能包含用户名或密码";
    }
  } catch {
    return "翻译 API URL 必须是有效的 http(s) 地址";
  }
  if (!`${model || ""}`.trim()) return "请填写翻译模型名称";
  return "";
}

export function translationWorkersError(value: unknown, providerId = "custom") {
  const workers = Number(value);
  const definition = getTranslationProviderDefinition(providerId);
  const maxWorkers = Number(definition.maxWorkers) || 100;
  if (!Number.isInteger(workers) || workers < 1 || workers > maxWorkers) {
    return `翻译并发数请输入 1–${maxWorkers} 的整数`;
  }
  return "";
}

export function translationProfileDefaults(providerId = "custom"): TranslationProfile {
  const definition = getTranslationProviderDefinition(providerId);
  return {
    apiKey: "",
    baseUrl: definition.baseUrl || "",
    model: definition.defaultModel || "",
    workers: Number(definition.defaultWorkers) || 5,
  };
}

export function normalizeTranslationProfile(
  providerId = "custom",
  candidate: Record<string, unknown> = {},
): TranslationProfile {
  const defaults = translationProfileDefaults(providerId);
  const definition = getTranslationProviderDefinition(providerId);
  const workers = Number(candidate.workers);
  const maxWorkers = Number(definition.maxWorkers) || 100;
  return {
    apiKey: typeof candidate.apiKey === "string" ? candidate.apiKey : defaults.apiKey,
    baseUrl: providerId === "custom"
      ? `${candidate.baseUrl || defaults.baseUrl}`.trim()
      : defaults.baseUrl,
    model: `${candidate.model || defaults.model}`.trim(),
    workers: Number.isInteger(workers) && workers > 0 && workers <= maxWorkers
      ? workers
      : defaults.workers,
  };
}

type CredentialDialogLike = HTMLDialogElement | HTMLElement | boolean | null;

export function dialogDataset(dialog: CredentialDialogLike | undefined): DOMStringMap | undefined {
  if (dialog && typeof dialog === "object" && "dataset" in dialog) {
    return (dialog as HTMLElement).dataset;
  }
  return undefined;
}
