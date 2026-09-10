window.__FRONT_RUNTIME_CONFIG__ = {
  // Rust API service root. Keep it at host:port level; do not append /api/v1.
  apiBase: "",
  // Rust API auth header value, sent as X-API-Key.
  xApiKey: "",
  // Default OCR provider for the browser UI: paddle | mineru.
  ocrProvider: "mineru",
  // OCR provider credential, submitted under payload.ocr.mineru_token.
  mineruToken: "",
  // OCR provider credential, submitted under payload.ocr.paddle_token.
  paddleToken: "",
  // Downstream model credential, submitted under payload.translation.api_key.
  modelApiKey: "",
  model: "deepseek-v4-flash",
  baseUrl: "https://api.deepseek.com/v1",
};
