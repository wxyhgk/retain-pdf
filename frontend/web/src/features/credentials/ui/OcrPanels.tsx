import {
  credentialTokenInputId,
  credentialValidateButtonId,
  credentialValidationId,
} from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import { OCR_PROVIDER_DEFINITIONS } from "@/platform/config/providers.js";
import { validationIcon } from "../domain/validation-icon.js";
import { ExternalLink, Info, KeyRound, PlugZap } from "lucide-react";
import { SecretInput } from "./SecretInput.js";
import { FieldLabel } from "./FieldLabel.jsx";
import {
  resetHandlerFor,
} from "./provider-panel-shared.js";

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
          content && validation.tone === "pending" ? "is-pending" : "",
        ].filter(Boolean).join(" ");

        return (
          <section
            key={provider.id}
            className={`credential-panel credential-provider-panel${active ? " is-active" : ""}`}
            data-ocr-provider-panel={provider.id}
            hidden={!active}
          >
            <label>
              <FieldLabel icon={<KeyRound />}>{provider.tokenLabel}</FieldLabel>
              <SecretInput
                id={credentialTokenInputId(provider.id)}
                secretLabel={provider.tokenLabel}
                autoComplete="off"
                placeholder={provider.tokenPlaceholder}
                defaultValue=""
                ref={tokenInputRef(provider.id)}
                onInput={() => resetHandlerFor(handlers)?.()}
              />
            </label>
            {!provider.supportsValidation ? (
              <p className="credential-ocr-hint"><Info aria-hidden="true" />{provider.validationUnavailableMessage}</p>
            ) : null}
            <div className="credential-card-footer">
              <div className="credential-card-actions">
                {provider.supportsValidation ? (
                  <button
                    id={credentialValidateButtonId(provider.id)}
                    type="button"
                    className="app-button secondary"
                    disabled={validation.tone === "pending"}
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
                  aria-label={content || provider.validationIdleMessage}
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
