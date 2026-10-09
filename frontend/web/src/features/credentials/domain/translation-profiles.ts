// 翻译凭据 profile 的状态管理工厂。
//
// 内聚 translationProfiles / currentTranslationProvider / lastCustomTranslationBaseUrl
// 三份可变状态，对外只暴露"水合 / 采集当前 / 应用 / 记录当前"等语义方法；
// 纯归一化与校验文案仍复用 translation-profile.ts。

import {
  getTranslationProviderDefinition,
  inferTranslationProvider,
  normalizeTranslationProvider,
  TRANSLATION_PROVIDER_OPTIONS,
} from "@/platform/config/providers.js";
import {
  normalizeTranslationProfile,
  translationProfileDefaults,
  type TranslationProfile,
} from "./translation-profile.js";

type TranslationProfileElements = {
  apiKeyInput?: { value?: string } | null;
  modelBaseUrlInput?: { value?: string } | null;
  modelNameInput?: { value?: string } | null;
  translationWorkersInput?: { value?: string } | null;
  translationProtocolSelect?: { value?: string } | null;
  translationThinkingSelect?: { value?: string } | null;
};

export function createTranslationProfiles({
  dialogElementsPort,
  setTranslationProvider,
}: {
  dialogElementsPort: { elements: () => TranslationProfileElements };
  setTranslationProvider?: (provider?: string) => void;
}) {
  let translationProfiles: Record<string, TranslationProfile> = Object.fromEntries(
    TRANSLATION_PROVIDER_OPTIONS.map((provider) => [
      provider.id,
      translationProfileDefaults(provider.id),
    ]),
  );
  let currentTranslationProvider = "deepseek";
  let lastCustomTranslationBaseUrl = "";

  function hydrate(
    credentials: Record<string, unknown> = {},
    taskOptions: Record<string, unknown> = {},
  ) {
    const storedProfiles = taskOptions.translationProfiles
      && typeof taskOptions.translationProfiles === "object"
      ? taskOptions.translationProfiles as Record<string, Record<string, unknown>>
      : {};
    translationProfiles = Object.fromEntries(
      TRANSLATION_PROVIDER_OPTIONS.map((provider) => [
        provider.id,
        normalizeTranslationProfile(provider.id, storedProfiles[provider.id] || {}),
      ]),
    );
    const inferredProvider = inferTranslationProvider(`${taskOptions.baseUrl || ""}`);
    currentTranslationProvider = normalizeTranslationProvider(
      `${taskOptions.translationProvider || inferredProvider}`,
    );
    if (!translationProfiles[currentTranslationProvider]?.apiKey && credentials.modelApiKey) {
      translationProfiles[currentTranslationProvider] = normalizeTranslationProfile(
        currentTranslationProvider,
        {
          ...(storedProfiles[currentTranslationProvider] || {}),
          apiKey: `${credentials.modelApiKey || ""}`,
          baseUrl: `${taskOptions.baseUrl || ""}`,
          model: `${taskOptions.model || ""}`,
          workers: taskOptions.workers,
        },
      );
    }
    lastCustomTranslationBaseUrl = translationProfiles.custom?.baseUrl || "";
  }

  function captureCurrent() {
    const elements = dialogElementsPort.elements();
    translationProfiles[currentTranslationProvider] = normalizeTranslationProfile(
      currentTranslationProvider,
      {
        apiKey: elements.apiKeyInput?.value || "",
        baseUrl: elements.modelBaseUrlInput?.value || "",
        model: elements.modelNameInput?.value || "",
        workers: elements.translationWorkersInput?.value || "",
        apiProtocol: elements.translationProtocolSelect?.value || "",
        thinking: elements.translationThinkingSelect?.value || "",
      },
    );
    if (currentTranslationProvider === "custom") {
      lastCustomTranslationBaseUrl = translationProfiles.custom.baseUrl;
    }
  }

  function persistable() {
    return translationProfiles;
  }

  function applyProfile(providerId = "custom") {
    const provider = normalizeTranslationProvider(providerId);
    const definition = getTranslationProviderDefinition(provider);
    const profile = translationProfiles[provider] || translationProfileDefaults(provider);
    const elements = dialogElementsPort.elements();
    currentTranslationProvider = provider;
    if (elements.apiKeyInput) elements.apiKeyInput.value = profile.apiKey;
    if (elements.modelBaseUrlInput) {
      elements.modelBaseUrlInput.value = provider === "custom"
        ? (profile.baseUrl || lastCustomTranslationBaseUrl)
        : definition.baseUrl;
    }
    if (elements.modelNameInput) elements.modelNameInput.value = profile.model;
    if (elements.translationWorkersInput) elements.translationWorkersInput.value = `${profile.workers}`;
    if (elements.translationProtocolSelect) elements.translationProtocolSelect.value = profile.apiProtocol;
    if (elements.translationThinkingSelect) elements.translationThinkingSelect.value = profile.thinking;
    setTranslationProvider?.(provider);
  }

  function providerFromBaseUrl(baseUrl = "") {
    const provider = inferTranslationProvider(baseUrl);
    return provider === "custom" ? "openai_compatible" : provider;
  }

  function getCurrentProvider() {
    return currentTranslationProvider;
  }

  function getCurrentProfile(): TranslationProfile {
    return translationProfiles[currentTranslationProvider]
      || translationProfileDefaults(currentTranslationProvider);
  }

  function defaultWorkers() {
    return getTranslationProviderDefinition(currentTranslationProvider).defaultWorkers;
  }

  function recordCurrentProfile(profile: Partial<TranslationProfile>) {
    translationProfiles[currentTranslationProvider] = normalizeTranslationProfile(
      currentTranslationProvider,
      profile,
    );
  }

  return {
    hydrate,
    captureCurrent,
    persistable,
    applyProfile,
    providerFromBaseUrl,
    getCurrentProvider,
    getCurrentProfile,
    defaultWorkers,
    recordCurrentProfile,
  };
}
