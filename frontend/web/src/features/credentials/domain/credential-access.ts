// 凭据只读访问：从 credentialsStatePort 派生当前 OCR/翻译凭据视图。
// 纯读逻辑，供 vault / dialog-flow / save-flow 共用。

import { normalizeOcrProvider, ocrKeyBorrowable } from "@/platform/config/providers.js";
import type { CredentialsFields, CredentialsStatePort } from "./state.js";

export function createCredentialAccess({
  credentialsStatePort,
  defaultPaddleToken,
}: {
  credentialsStatePort: CredentialsStatePort;
  defaultPaddleToken?: () => string;
}) {
  function readCurrentCredentials(): CredentialsFields {
    return credentialsStatePort.getCredentials();
  }

  function currentOcrProvider(): string {
    return normalizeOcrProvider(credentialsStatePort.getCredentials?.().ocrProvider);
  }

  function hasBrowserCredentials(): boolean {
    return Boolean(credentialsStatePort.hasComplete?.({ defaultPaddleToken }));
  }

  function hasOcrCredentials(): boolean {
    const credentials = readCurrentCredentials();
    return Boolean(
      credentials.ocrCredentialRef
      || credentialsStatePort.getOcrToken?.({ defaultPaddleToken })
      // GLM-OCR 可以借智谱翻译的 key。
      || (ocrKeyBorrowable(credentials.ocrProvider) && (credentials.modelApiKey || credentials.translationCredentialRef)),
    );
  }

  return {
    readCurrentCredentials,
    currentOcrProvider,
    hasBrowserCredentials,
    hasOcrCredentials,
  };
}
