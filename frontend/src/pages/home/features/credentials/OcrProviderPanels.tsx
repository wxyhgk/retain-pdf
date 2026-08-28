// OCR provider Thẻ(Độ tương phản cũ components/dialogs/browser-credentials-dialog.js
// của ocrProviderPanels hợp lại + features/credentials/validation-view.js của
// Xác minh ngữ nghĩa logo,Số hồ sơ chết import,Được sử dụng ở đây JSX Viết lại có cấu trúc)。
//
// trước mặt OCR_PROVIDER_DEFINITIONS Chỉ đăng ký paddle "Một!" provider(config/providers.js),
// Bảng điều khiển kết xuất theo mảng cấu hình,Không được mã hóa cứng provider id——Future Plus Back provider Chỉ cần mở rộng mảng。
// token Đầu vào không được kiểm soát ref(thấy credentials-view-store.js elementsRef),
// dialog-values.js/dialog-sync.js(kept)Đọc/Ghi trực tiếp .value。

import {
  credentialTokenInputId,
  credentialValidateButtonId,
  credentialValidationId,
} from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import { OCR_PROVIDER_DEFINITIONS } from "../../composition/external.js";

function validationIcon(tone = "", content = "") {
  if (!content) {
    return "";
  }
  if (tone === "valid") {
    return "✓";
  }
  if (tone === "error") {
    return "!";
  }
  return "…";
}

function resetHandlerFor(handlers) {
  return handlers?.resetPaddleValidation;
}

export function OcrProviderPanels() {
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
            role="tabpanel"
            hidden={!active}
          >
            <label>
              <span className="credential-input-row">
                <span className="credential-secret-field">
                  <input
                    id={credentialTokenInputId(provider.id)}
                    type="password"
                    autoComplete="off"
                    placeholder={provider.tokenPlaceholder}
                    defaultValue=""
                    ref={tokenInputRef(provider.id)}
                    onInput={() => resetHandlerFor(handlers)?.()}
                  />
                </span>
                <a className="credential-card-link" href={provider.docsUrl} target="_blank" rel="noopener noreferrer">
                  {provider.docsLabel}
                </a>
              </span>
            </label>
            <div className="credential-card-actions">
              {provider.supportsValidation ? (
                <button
                  id={credentialValidateButtonId(provider.id)}
                  type="button"
                  className="app-button secondary"
                  onClick={() => handlers?.validateOcr?.()}
                >
                  {provider.validationButtonLabel}
                </button>
              ) : null}
              <span id={credentialValidationId(provider.id)} className={badgeClasses} title={content || provider.validationIdleMessage}>
                {validationIcon(validation.tone, content)}
              </span>
            </div>
          </section>
        );
      })}
    </div>
  );
}
