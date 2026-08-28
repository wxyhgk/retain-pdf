// Credentials/SettingsHub của hộp thoại DOM Hợp đồng id bản chính。
//
// Sao chép từ src/js/features/credentials/credentials-dom-contract.js(Tên tệp này
// trúng mục tiêu architecture-boundaries.test.mjs của features/*dom-contract.js Chống đạn
// Thường xuyên,ngay cả khi bản thân nội dung không có logic id Hằng) ——3b Miền thẻ trạng thái đã được sao chép theo cùng một cách
// status-card-dom-ids.js,Sau đây là những việc cần làm)VÀ
// src/js/components/dialogs/app-settings-dialog-contract.js(Toàn bộ danh mục đã cũ
// Lớp chế độ xem phần tử tùy chỉnh,cấm chỉ pages import)。id Chuỗi theo chuỗi,Đường cơ sở trực quan so với
// Kiểm soát truy cập nhấn các nút này id chắc chắn;Tăng  id Không bao giờ đổi tên chuỗi thế giới cũ。

export const CREDENTIAL_DOM_IDS = {
  dialog: "browser-credentials-dialog",
  trigger: "credentials-btn",
  gate: "credential-gate",
  gateAction: "credential-gate-action",
  file: "file",
  hidden: {
    ocrProvider: "ocr_provider",
    paddleToken: "paddle_token",
    modelApiKey: "api_key",
  },
  browser: {
    title: "browser-credentials-title",
    subtitle: "browser-credentials-subtitle",
    closeButton: "browser-credentials-close-btn",
    status: "browser-credentials-status",
    tabs: "browser-credentials-tabs",
    tabApi: "browser-credential-tab-api",
    tabTask: "browser-credential-tab-task",
    saveButton: "browser-credentials-save-btn",
    ocrProviderSelect: "browser-ocr-provider-select",
    apiKey: "browser-api-key",
    modelBaseUrl: "browser-model-base-url",
    modelName: "browser-model-name",
    mathMode: "browser-job-math-mode",
    deepSeekValidateButton: "browser-deepseek-validate-btn",
    deepSeekTopUpLink: "browser-deepseek-top-up-link",
    deepSeekValidation: "browser-deepseek-validation",
  },
};

// OCR provider bảng/kiểm tra/token truyền vào id Nhấn Tất cả provider.id hợp lại(Gương Cũ
// components/dialogs/browser-credentials-dialog.js Quy tắc khâu mẫu cho)。
export function credentialTokenInputId(providerId = "") {
  return `browser-${providerId}-token`;
}

export function credentialValidateButtonId(providerId = "") {
  return `browser-${providerId}-validate-btn`;
}

export function credentialValidationId(providerId = "") {
  return `browser-${providerId}-validation`;
}

export const CREDENTIAL_DOM_DATASETS = {
  setupMode: "setupMode",
  credentialTab: "credentialTab",
  credentialPanel: "credentialPanel",
  ocrProviderPanel: "ocrProviderPanel",
};

// SettingsHubDialog(kế hoạch xây dựng §0.4,Sao chép từ
// src/js/components/dialogs/app-settings-dialog-contract.js)。
export const APP_SETTINGS_DIALOG_IDS = {
  dialog: "app-settings-dialog",
  openButton: "app-settings-btn",
  closeButton: "app-settings-close-btn",
  /** Nghỉ hưu（Thiết lập v2：API Nhúng trong khu vực CredentialsWorkbench，Không có lối vào bật lên hai lớp）。
   *  Giữ các hằng số chỉ để so sánh lịch sử，Không thêm điểm tiêu thụ。 */
  credentialsButton: "credentials-btn",
  // Bảng chú giải thuật ngữ/Cập nhật hai tab Chỉ giữ chỗ ở giai đoạn này(kế hoạch xây dựng §0.4);id Tiếp đất trước để theo dõi agent xếp hợp lý。
  glossaryButton: "glossary-btn",
  appUpdateButton: "app-update-btn",
};

export const APP_SETTINGS_DIALOG_DATASETS = {
  settingsTab: "settingsTab",
  settingsPanel: "settingsPanel",
};
