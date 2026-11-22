import { useReducer } from "react";
import { BrandLogo } from "@/ui/icons/BrandLogo.jsx";
import { vendorLogoForBaseUrl, type BrandLogo as BrandLogoEntry } from "@/platform/config/brand-logos.js";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import {
  translationProtocolFor,
  getTranslationProviderDefinition,
  TRANSLATION_API_PROTOCOL_OPTIONS,
  TRANSLATION_PROVIDER_DEFINITION,
  TRANSLATION_THINKING_OPTIONS,
  TRANSLATION_PROVIDER_OPTIONS,
} from "@/platform/config/providers.js";
import { validationIcon } from "../domain/validation-icon.js";
import { Box, Brain, Cable, Check, ChevronDown, Code2, ExternalLink, Gauge, KeyRound, Languages, Layers, Link2, PlugZap, Server, TriangleAlert } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { SecretInput } from "./SecretInput.js";
import { FieldLabel } from "./FieldLabel.jsx";
import { Input } from "@retainpdf/ui";
import { ProviderModelPicker } from "./ProviderModelPicker.jsx";
import { parseModelList } from "../domain/translation-profile.js";

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;

type TranslationProviderDefinition = ReturnType<typeof getTranslationProviderDefinition>;

function TranslationProviderMark({ provider, compact = false, logo = provider.logo }: {
  provider: TranslationProviderDefinition;
  compact?: boolean;
  /** 自定义接口：按填的地址认出来的那家（不给就用服务商自己的）。 */
  logo?: BrandLogoEntry | null;
}) {
  if (logo) {
    return <BrandLogo className={`credential-translation-provider-logo${compact ? " is-compact" : ""}`} logo={logo} />;
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
  // 自定义接口填了哪家的地址就显示哪家的标志。地址框是非受控的（表单同步直接写值），渲染时读它当前的值，
  // 用户每敲一下 bump 一次让这里重新读。
  const [, bumpBaseUrl] = useReducer((count: number) => count + 1, 0);
  const customLogo = fixedBaseUrl ? null : vendorLogoForBaseUrl(elementsRef.modelBaseUrlInput?.value);
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
      </div>
      {/* 三组：连接（服务、地址、key）、模型（模型、并发、其他模型）、高级（协议、思考）。2026-11-21 用户：排版乱、没有呼吸感。 */}
      <div className="credential-translation-groups">
        <div className="credential-translation-group" data-credential-group="connection">
          <p className="credential-translation-group-title">连接</p>
          <div className="credential-translation-grid">
            <label className="credential-translation-provider-field">
              <FieldLabel icon={<Server />}>API 服务</FieldLabel>
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
                    <TranslationProviderMark provider={providerDefinition} compact logo={fixedBaseUrl ? providerDefinition.logo : customLogo} />
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
              <FieldLabel icon={<Link2 />}>API URL</FieldLabel>
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
                onInput={() => {
                  handlers?.resetDeepSeekValidation?.();
                  bumpBaseUrl();
                }}
              />
            </label>
            <label className="credential-translation-key-field">
              <FieldLabel icon={<KeyRound />}>API Key</FieldLabel>
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
          </div>
        </div>
        <div className="credential-translation-group" data-credential-group="model">
          <p className="credential-translation-group-title">模型</p>
          <div className="credential-translation-grid">
            <label className="credential-translation-model-field">
              <FieldLabel icon={<Box />}>模型</FieldLabel>
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
            <label className="credential-translation-workers-field">
              <FieldLabel icon={<Gauge />}>并发数</FieldLabel>
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
            {providerDefinition.id === "custom" ? (
              <p className="credential-custom-api-warning" role="note">
                <TriangleAlert aria-hidden="true" />
                自定义 API 建议并发不超过 5，过高可能导致接口异常。
              </p>
            ) : null}
            <div className="credential-translation-models-field">
              <ProviderModelPicker
                readRequest={() => {
                  const apiKey = `${elementsRef.apiKeyInput?.value || ""}`.trim();
                  if (!apiKey) return { error: "先填 API Key 再拉。" };
                  const baseUrl = `${elementsRef.modelBaseUrlInput?.value || providerDefinition.baseUrl || ""}`.trim();
                  return {
                    base_url: baseUrl,
                    api_key: apiKey,
                    api_protocol: translationProtocolFor(baseUrl, elementsRef.translationProtocolSelect?.value || providerDefinition.protocol || "openai_responses"),
                  };
                }}
                readCurrent={() => {
                  const model = `${elementsRef.modelNameInput?.value || ""}`.trim();
                  return { model, extras: parseModelList(elementsRef.extraModelsInput?.value || "", model) };
                }}
                onApply={({ model, extras }) => {
                  if (elementsRef.modelNameInput) elementsRef.modelNameInput.value = model;
                  if (elementsRef.extraModelsInput) elementsRef.extraModelsInput.value = extras.join(", ");
                  handlers?.resetDeepSeekValidation?.();
                }}
              />
            </div>
            <label className="credential-translation-models-field">
              <FieldLabel icon={<Layers />}>其他模型（可不填）</FieldLabel>
              <Input
                id={BROWSER_IDS.extraModels}
                type="text"
                autoComplete="off"
                placeholder="用逗号隔开，比如 deepseek-v4-pro, deepseek-v4-flash"
                title="这把 key 还能用的其他模型。书详情「重新翻译」时可以换成它们，旁边写着估价。"
                defaultValue=""
                ref={(node) => { elementsRef.extraModelsInput = node || null; }}
              />
            </label>
          </div>
        </div>
        <div className="credential-translation-group" data-credential-group="advanced">
          <p className="credential-translation-group-title">高级</p>
          <div className="credential-translation-grid">
            <label className="credential-translation-protocol-field">
              <FieldLabel icon={<Cable />}>接口协议</FieldLabel>
              <span className="credential-select">
                <select
                  id={BROWSER_IDS.translationProtocol}
                  defaultValue={providerDefinition.protocol}
                  title="翻译请求用哪种接口格式。Anthropic 官方用 Anthropic 格式，其余用 OpenAI Responses 格式（/chat/completions 已去掉）。"
                  ref={(node) => { elementsRef.translationProtocolSelect = node || null; }}
                  onChange={() => handlers?.resetDeepSeekValidation?.()}
                >
                  {TRANSLATION_API_PROTOCOL_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{`${option.label}（${option.hint}）`}</option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" />
              </span>
            </label>
            <label className="credential-translation-thinking-field">
              <FieldLabel icon={<Brain />}>思考深度</FieldLabel>
              <span className="credential-select">
                <select
                  id={BROWSER_IDS.translationThinking}
                  defaultValue="off"
                  title="默认关闭，翻译一般用不着思考。自动：能关就关。调深会更慢、更贵；服务商不支持的档位会自动退回。"
                  ref={(node) => { elementsRef.translationThinkingSelect = node || null; }}
                >
                  {TRANSLATION_THINKING_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" />
              </span>
            </label>
          </div>
        </div>
      </div>
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
