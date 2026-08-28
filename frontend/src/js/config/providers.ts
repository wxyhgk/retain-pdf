export const DEFAULT_OCR_PROVIDER = "paddle";

export const OCR_PROVIDER_DEFINITIONS = [
  {
    id: "paddle",
    label: "PaddleOCR",
    description: "OCR trực tuyến.",
    tokenField: "paddle_token",
    runtimeConfigKey: "paddleToken",
    tokenLabel: "Paddle Access Token",
    tokenPlaceholder: "Paddle Access Token",
    validationButtonLabel: "Kiểm tra Paddle",
    validationIdleMessage: "Chưa kiểm tra",
    validationMissingMessage: "Vui lòng điền Paddle Access Token trước.",
    validationUnavailableMessage: "",
    docsUrl: "https://aistudio.baidu.com/account/accessToken",
    docsLabel: "Lấy Token",
    supportsValidation: true,
  },
];

export const TRANSLATION_PROVIDER_DEFINITION = {
  id: "deepseek",
  label: "DeepSeek",
  keyLabel: "DeepSeek Key",
  keyPlaceholder: "DeepSeek API Key",
  description: "Mô hình dịch thuật.",
  docsUrl: "https://platform.deepseek.com/api_keys",
  docsLabel: "Lấy Key",
  validationButtonLabel: "Kiểm tra DeepSeek",
  validationIdleMessage: "Chưa kiểm tra",
  validationMissingMessage: "Vui lòng điền DeepSeek Key trước.",
  validationSuccessMessage: "Kết nối API DeepSeek thành công.",
  validationNetworkMessage: "Kiểm tra API DeepSeek thất bại, vui lòng kiểm tra mạng hoặc hạn chế CORS của trình duyệt.",
  validationUnauthorizedMessage: "DeepSeek Key không hợp lệ hoặc đã hết hạn.",
};

export function normalizeOcrProvider(value) {
  const provider = `${value || ""}`.trim().toLowerCase();
  return OCR_PROVIDER_DEFINITIONS.some((item) => item.id === provider) ? provider : DEFAULT_OCR_PROVIDER;
}

export function getOcrProviderDefinition(provider) {
  return OCR_PROVIDER_DEFINITIONS.find((item) => item.id === normalizeOcrProvider(provider)) || OCR_PROVIDER_DEFINITIONS[0];
}
