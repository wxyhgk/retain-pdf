import { getOcrProviderDefinition } from "@/platform/config/providers.js";
import {
  credentialOcrToken,
} from "./selectors-port.js";
import { defaultCredentialsStatePort } from "./default-state-port.js";
import { runOcrTokenValidation } from "./validation.js";
import type { RunOcrTokenValidationOptions } from "./validation.js";
import type { CredentialsFields, CredentialsStatePort } from "./state.js";

export async function ensureOcrCredentialValidationReady({
  apiPrefix,
  state,
  providerId,
  credentials,
  defaultPaddleToken,
  validateOcrToken,
  setOcrValidationMessage,
  showResult,
  credentialsStatePort = defaultCredentialsStatePort,
  legacyRuntimePort,
  legacyValidationCachePort,
}: {
  apiPrefix?: string;
  state?: unknown;
  providerId: string;
  credentials: CredentialsFields;
  defaultPaddleToken?: () => string;
  validateOcrToken?: RunOcrTokenValidationOptions["validateOcrToken"];
  setOcrValidationMessage?: (message?: string, tone?: string, providerId?: string) => void;
  showResult: boolean;
  credentialsStatePort?: CredentialsStatePort;
  legacyRuntimePort?: unknown;
  legacyValidationCachePort?: unknown;
}) {
  const definition = getOcrProviderDefinition(providerId);
  const credentialRef = `${credentials?.ocrCredentialRef || ""}`.trim();
  const token = credentialOcrToken(credentials, {
    providerId: definition.id,
    defaultPaddleToken,
  }).trim();
  if (!token && credentialRef) {
    return {
      ok: true,
      status: "stored",
      definition,
      credentialRef,
      token: "",
      result: null,
    };
  }

  if (!token) {
    return {
      ok: false,
      status: "missing_token",
      definition,
      token,
      result: null,
    };
  }

  const hasCachedValidation = credentialsStatePort.hasValidOcrValidationCache?.({
    provider: definition.id,
    token,
  });
  if (hasCachedValidation) {
    return {
      ok: true,
      status: "cached",
      definition,
      token,
      result: null,
    };
  }

  const result = await runOcrTokenValidation({
    apiPrefix,
    state,
    credentialsStatePort,
    providerId: definition.id,
    token,
    validateOcrToken,
    setOcrValidationMessage,
    showResult,
  });
  return {
    ok: !!result.ok,
    status: result.status || "",
    definition,
    token,
    result,
  };
}
