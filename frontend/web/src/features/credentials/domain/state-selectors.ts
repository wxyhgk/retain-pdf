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

/**
 * 这家 OCR 现在能不能用（上传弹窗挑 OCR 时，没设好的那几家灰掉）：本机存了它的 Token；或者它就是设置里选的那家、
 * 存的是凭据库引用；或者是 GLM-OCR、可以借翻译的 key。
 */
export function ocrReadyFor(
  credentials: Partial<CredentialsFields> = {},
  options: OcrTokenOptions = {},
): boolean {
  const provider = normalizeOcrProvider(options.providerId || credentials.ocrProvider);
  const translationReady = Boolean(credentials.modelApiKey || credentials.translationCredentialRef);
  const ownRef = provider === normalizeOcrProvider(credentials.ocrProvider) && Boolean(credentials.ocrCredentialRef);
  return ownRef
    || Boolean(ocrTokenFromCredentials(credentials, { ...options, providerId: provider }))
    || (ocrKeyBorrowable(provider) && translationReady);
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
