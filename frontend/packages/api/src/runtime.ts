/**
 * Stable browser-aware runtime configuration helpers.
 *
 * Consumers should use `@retainpdf/api/runtime`; the historical
 * `@retainpdf/api/internal/runtime` subpath remains available for compatibility.
 */
export {
  API_PREFIX,
  apiBase,
  buildApiHeaders,
  buildApiUrl,
  frontendApiKey,
  getRuntimeConfig,
  stripOcrSuffix,
  unwrapEnvelope,
} from "./internal/runtime.js";
