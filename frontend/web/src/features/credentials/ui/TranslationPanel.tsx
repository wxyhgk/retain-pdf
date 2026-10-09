import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import {
  getTranslationProviderDefinition,
  TRANSLATION_API_PROTOCOL_OPTIONS,
  TRANSLATION_PROVIDER_DEFINITION,
  TRANSLATION_THINKING_OPTIONS,
  TRANSLATION_PROVIDER_OPTIONS,
} from "@/platform/config/providers.js";
import { validationIcon } from "../domain/validation-icon.js";
import { Check, ChevronDown, Code2, ExternalLink, Languages, PlugZap, TriangleAlert } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { SecretInput } from "./SecretInput.js";

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;

type TranslationProviderDefinition = ReturnType<typeof getTranslationProviderDefinition>;

function TranslationProviderMark({ provider, compact = false }: { provider: TranslationProviderDefinition; compact?: boolean }) {
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

export function TranslationPanel({ footerAction = null }: { footerAction?: React.ReactNode } = {}) {
  const { credentials, view, handlers, elementsRef } = useCredentialsController();
  const translationProvider = `${view.translationProvider || "custom"}`;
  const providerDefinition = getTranslationProviderDefinition(translationProvider);
  const fixedBaseUrl = providerDefinition.id !== "custom";
  const validation = view.deepSeek || { message: "", tone: "" };
  const content = `${validation.message || ""}`.trim();
  // 只有 tone === "pending" 才算「检测进行中」。此前用「有消息且无 tone」推断，
  // 会把中性提示（如「使用旧配置；请填写 Key 后检测」）误判成进行中并锁死按钮。
  const pending = validation.tone === "pending";
  const badgeClasses = [
    "token-inline-status",
    content ? "" : "hidden",
    validation.tone === "valid" ? "is-valid" : "",
    validation.tone === "error" ? "is-error" : "",
    content && pending ? "is-pending" : "",
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
            title={fixedBaseUrl ? `${providerDefinition.label} 官方地址，由服务商选项管理` : "自定义 API 地址"}
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
            placeholder={TRANSLATION_PROVIDER_DEFINITION.keyPlaceholder}
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
        <label className="credential-translation-protocol-field">
          <span className="developer-label">接口协议</span>
          <select
            id={BROWSER_IDS.translationProtocol}
            defaultValue={providerDefinition.protocol}
            title="翻译请求用哪种接口格式。Anthropic 官方默认 Anthropic 格式，其余默认 OpenAI 格式；中转站按它支持的格式选。"
            ref={(node) => { elementsRef.translationProtocolSelect = node || null; }}
            onChange={() => handlers?.resetDeepSeekValidation?.()}
          >
            {TRANSLATION_API_PROTOCOL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{`${option.label}（${option.hint}）`}</option>
            ))}
          </select>
        </label>
        <label className="credential-translation-thinking-field">
          <span className="developer-label">思考深度</span>
          <select
            id={BROWSER_IDS.translationThinking}
            defaultValue="auto"
            title="自动：能关就关，翻译一般用不着思考。调深会更慢、更贵；服务商不支持的档位会自动退回。"
            ref={(node) => { elementsRef.translationThinkingSelect = node || null; }}
          >
            {TRANSLATION_THINKING_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
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
            disabled={pending}
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
