// Copy to runtime-config.local.js for local overrides.
// Do NOT put secrets here (modelApiKey / OCR tokens / X-API-Key).
// Fill those in the app: Settings → Credentials.
window.__FRONT_RUNTIME_CONFIG__ = {
  ...(window.__FRONT_RUNTIME_CONFIG__ || {}),
  // Rust API service root. Keep it at host:port level; do not append /api/v1.
  apiBase: "http://127.0.0.1:41000",
  // Leave empty; set via Settings → Credentials (or desktop config).
  xApiKey: "",
  ocrProvider: "paddle",
  mineruToken: "",
  paddleToken: "",
  modelApiKey: "",
  model: "deepseek-v4-flash",
  baseUrl: "https://api.deepseek.com/v1",
};
