import type {
  CredentialsFields,
  OcrTokenOptions,
} from "./state-types.js";
import { normalizeOcrProvider, ocrKeyBorrowable } from "@/platform/config/providers.js";

export function ocrTokenFromCredentials(
  credentials: Partial<CredentialsFields> = {},
  { defaultPaddleToken, providerId }: OcrTokenOptions = {},
): string {
  const provider = normalizeOcrProvider(providerId || credentials.ocrProvider);
  if (provider === "mineru") {
    return credentials.mineruToken || "";
  }
  if (provider === "glm_ocr") {
    return credentials.glmOcrToken || "";
  }
  const token = credentials.paddleToken;
  if (token) {
    return token;
  }
  return defaultPaddleToken?.() || "";
}

export function hasCompleteCredentials(
  credentials: Partial<CredentialsFields> = {},
  options: OcrTokenOptions = {},
): boolean {
  const translationReady = Boolean(credentials.modelApiKey || credentials.translationCredentialRef);
  // GLM-OCR 没填自己的 key 时借智谱翻译的 key（保存时已经核过翻译是智谱）。
  const ocrReady = Boolean(credentials.ocrCredentialRef || ocrTokenFromCredentials(credentials, options))
    || (ocrKeyBorrowable(options.providerId || credentials.ocrProvider) && translationReady);
  return ocrReady && translationReady;
}
