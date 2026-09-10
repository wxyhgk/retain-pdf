// 凭据提供方面板（合并原 OCR 与翻译模型两块，分 provider 渲染）
// 校验徽标语义抽至 shared/credentials/validation-icon

import {
  credentialTokenInputId,
  credentialValidateButtonId,
  credentialValidationId,
} from "./credentials-dom-ids.js";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import {
  getTranslationProviderDefinition,
  OCR_PROVIDER_DEFINITIONS,
  TRANSLATION_PROVIDER_DEFINITION,
  TRANSLATION_PROVIDER_OPTIONS,
} from "@/platform/config/providers.js";
import { validationIcon } from "../domain/validation-icon.js";
import { Check, ChevronDown, Code2, ExternalLink, Languages, PlugZap, TriangleAlert } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { SecretInput } from "./SecretInput.js";

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;

function storedSecretPlaceholder(label: string) {
  return `••••••••••••（${label} 已安全保存，输入新值可替换）`;
}

function resetHandlerFor(handlers) {
  return handlers?.resetPaddleValidation;
}

function TranslationProviderMark({ provider, compact = false }) {
  if (provider.logoUrl) {
    return (
      <img
        className={`credential-translation-provider-logo${compact ? " is-compact" : ""}`}
        src={provider.logoUrl}
        alt=""
        aria-hidden="true"
      />
    );
  }
  return (
    <span className={`credential-translation-provider-logo is-custom${compact ? " is-compact" : ""}`} aria-hidden="true">
      <Code2 />
    </span>
  );
}

export function OcrPanels() {
  const { credentials, view, handlers, tokenInputRef } = useCredentialsController();
  const activeProvider = credentials.ocrProvider;

  return (
    <div className="credential-provider-panels">
      {OCR_PROVIDER_DEFINITIONS.map((provider) => {
        const active = provider.id === activeProvider;
        const validation = view.validations[provider.id] || { message: "", tone: "" };
        const content = `${validation.message || ""}`.trim();
        const badgeClasses = [
          "token-inline-status",
          content ? "" : "hidden",
          validation.tone === "valid" ? "is-valid" : "",
          validation.tone === "error" ? "is-error" : "",
          content && !validation.tone ? "is-pending" : "",
        ].filter(Boolean).join(" ");

        return (
          <section
            key={provider.id}
            className={`credential-panel credential-provider-panel${active ? " is-active" : ""}`}
            data-ocr-provider-panel={provider.id}
            hidden={!active}
          >
            <label>
              <span className="developer-label">Paddle Access Token</span>
              <SecretInput
                id={credentialTokenInputId(provider.id)}
                secretLabel="Paddle Access Token"
                autoComplete="off"
                placeholder={credentials.ocrCredentialRef
                  ? storedSecretPlaceholder("Paddle Token")
                  : provider.tokenPlaceholder}
                defaultValue=""
                ref={tokenInputRef(provider.id)}
                onInput={() => resetHandlerFor(handlers)?.()}
              />
            </label>
            <div className="credential-card-footer">
              <div className="credential-card-actions">
                {provider.supportsValidation ? (
                  <button
                    id={credentialValidateButtonId(provider.id)}
                    type="button"
                    className="app-button secondary"
                    onClick={() => handlers?.validateOcr?.()}
                  >
                    <PlugZap aria-hidden="true" />
                    {provider.validationButtonLabel}
                  </button>
                ) : null}
                <span
                  id={credentialValidationId(provider.id)}
                  className={badgeClasses}
                  title={content || provider.validationIdleMessage}
                  role="status"
                  aria-live="polite"
                >
                  {validationIcon(validation.tone, content)}
                </span>
                <a className="credential-card-link" href={provider.docsUrl} target="_blank" rel="noopener noreferrer">
                  {provider.docsLabel}
                  <ExternalLink aria-hidden="true" />
                </a>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function TranslationPanel({ footerAction = null }: { footerAction?: React.ReactNode } = {}) {
  const { credentials, view, handlers, elementsRef } = useCredentialsController();
  const translationProvider = `${view.translationProvider || "custom"}`;
  const providerDefinition = getTranslationProviderDefinition(translationProvider);
  const fixedBaseUrl = providerDefinition.id !== "custom";
  const validation = view.deepSeek || { message: "", tone: "" };
  const content = `${validation.message || ""}`.trim();
  const badgeClasses = [
    "token-inline-status",
    content ? "" : "hidden",
    validation.tone === "valid" ? "is-valid" : "",
    validation.tone === "error" ? "is-error" : "",
    content && !validation.tone ? "is-pending" : "",
  ].filter(Boolean).join(" ");

  return (
    <section className="credential-card credential-translation-card">
      <div className="credential-card-head credential-card-head-rich">
        <span className="credential-card-icon" aria-hidden="true"><Languages /></span>
        <div className="credential-card-copy">
          <h3>{TRANSLATION_PROVIDER_DEFINITION.label}</h3>
        </div>
        <span className="credential-card-tag">OpenAI 兼容</span>
      </div>
      <div className="credential-translation-grid">
        <label className="credential-translation-provider-field">
          <span className="developer-label">API 服务</span>
          <SelectPrimitive.Root
            value={providerDefinition.id}
            onValueChange={(value) => handlers?.changeTranslationProvider?.(value)}
          >
            <SelectPrimitive.Trigger
              id={BROWSER_IDS.translationProvider}
              className="credential-translation-provider-trigger"
              aria-label="翻译 API 服务商"
            >
              <span className="credential-translation-provider-value">
                <TranslationProviderMark provider={providerDefinition} compact />
                <span>{providerDefinition.label}</span>
              </span>
              <SelectPrimitive.Icon asChild>
                <ChevronDown aria-hidden="true" />
              </SelectPrimitive.Icon>
            </SelectPrimitive.Trigger>
            <SelectPrimitive.Portal>
              <SelectPrimitive.Content
                className="credential-translation-provider-content"
                position="popper"
                sideOffset={6}
                align="start"
              >
                <SelectPrimitive.Viewport className="credential-translation-provider-viewport">
                  {TRANSLATION_PROVIDER_OPTIONS.map((provider) => (
                    <SelectPrimitive.Item
                      key={provider.id}
                      value={provider.id}
                      className="credential-translation-provider-option"
                    >
                      <SelectPrimitive.ItemText>
                        <span className="credential-translation-provider-option-copy">
                          <TranslationProviderMark provider={provider} />
                          <span>{provider.label}</span>
                        </span>
                      </SelectPrimitive.ItemText>
                      <SelectPrimitive.ItemIndicator className="credential-translation-provider-check">
                        <Check aria-hidden="true" />
                      </SelectPrimitive.ItemIndicator>
                    </SelectPrimitive.Item>
                  ))}
                </SelectPrimitive.Viewport>
              </SelectPrimitive.Content>
            </SelectPrimitive.Portal>
          </SelectPrimitive.Root>
        </label>
        <label className="credential-translation-url-field">
          <span className="developer-label">API URL</span>
          <input
            id={BROWSER_IDS.modelBaseUrl}
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://api.example.com/v1"
            defaultValue=""
            readOnly={fixedBaseUrl}
            aria-readonly={fixedBaseUrl}
            title={fixedBaseUrl ? `${providerDefinition.label} 官方地址，由服务商选项管理` : "自定义 OpenAI 兼容 API 地址"}
            ref={(node) => { elementsRef.modelBaseUrlInput = node || null; }}
            onInput={() => handlers?.resetDeepSeekValidation?.()}
          />
        </label>
        <label className="credential-translation-model-field">
          <span className="developer-label">模型</span>
          <input
            id={BROWSER_IDS.modelName}
            type="text"
            autoComplete="off"
            placeholder="模型名称"
            defaultValue=""
            ref={(node) => { elementsRef.modelNameInput = node || null; }}
            onInput={() => handlers?.resetDeepSeekValidation?.()}
          />
        </label>
        <label className="credential-translation-key-field">
          <span className="developer-label">API Key</span>
          <SecretInput
            id={BROWSER_IDS.apiKey}
            secretLabel="翻译 API Key"
            autoComplete="off"
            placeholder={credentials.translationCredentialRef
              ? storedSecretPlaceholder("翻译 API Key")
              : TRANSLATION_PROVIDER_DEFINITION.keyPlaceholder}
            defaultValue=""
            ref={(node) => { elementsRef.apiKeyInput = node || null; }}
            onInput={() => handlers?.resetDeepSeekValidation?.()}
          />
        </label>
        <label className="credential-translation-workers-field">
          <span className="developer-label">并发数</span>
          <input
            id={BROWSER_IDS.translationWorkers}
            type="number"
            inputMode="numeric"
            min="1"
            max={`${providerDefinition.maxWorkers || 100}`}
            step="1"
            autoComplete="off"
            placeholder={`${providerDefinition.defaultWorkers || 5}`}
            title={`${providerDefinition.label} 同时发送的翻译请求数（1–${providerDefinition.maxWorkers || 100}）`}
            aria-label="翻译并发数"
            defaultValue=""
            ref={(node) => { elementsRef.translationWorkersInput = node || null; }}
          />
        </label>
      </div>
      {providerDefinition.id === "custom" ? (
        <p className="credential-custom-api-warning" role="note">
          <TriangleAlert aria-hidden="true" />
          自定义 API 建议并发不超过 5，过高可能导致接口异常。
        </p>
      ) : null}
      <div className="credential-card-footer">
        <div className="credential-card-actions">
          <button
            id={BROWSER_IDS.deepSeekValidateButton}
            type="button"
            className="app-button secondary"
            onClick={() => handlers?.validateDeepSeek?.()}
          >
            <PlugZap aria-hidden="true" />
            {TRANSLATION_PROVIDER_DEFINITION.validationButtonLabel}
          </button>
          <span
            id={BROWSER_IDS.deepSeekValidation}
            className={badgeClasses}
            title={content || TRANSLATION_PROVIDER_DEFINITION.validationIdleMessage}
            role="status"
            aria-live="polite"
          >
            {validationIcon(validation.tone, content)}
          </span>
          {providerDefinition.docsUrl ? (
            <a className="credential-card-link" href={providerDefinition.docsUrl} target="_blank" rel="noopener noreferrer">
              {providerDefinition.docsLabel}
              <ExternalLink aria-hidden="true" />
            </a>
          ) : null}
          {providerDefinition.billingUrl ? (
            <a className="credential-card-link" href={providerDefinition.billingUrl} target="_blank" rel="noopener noreferrer">
              {providerDefinition.billingLabel}
              <ExternalLink aria-hidden="true" />
            </a>
          ) : null}
          {providerDefinition.id === "deepseek" ? (
            <a
              id={BROWSER_IDS.deepSeekTopUpLink}
              className={`credential-top-up-link${view.deepSeekTopUpVisible ? "" : " hidden"}`}
              href="https://platform.deepseek.com/top_up"
              target="_blank"
              rel="noopener noreferrer"
            >
              DeepSeek 充值
              <ExternalLink aria-hidden="true" />
            </a>
          ) : (
            <span id={BROWSER_IDS.deepSeekTopUpLink} className="hidden" />
          )}
        </div>
        {footerAction}
      </div>
    </section>
  );
}

// 兼容旧调用：统一 Provider 面板（可选）
export function ProviderPanels() {
  return (
    <>
      <OcrPanels />
      <TranslationPanel />
    </>
  );
}
