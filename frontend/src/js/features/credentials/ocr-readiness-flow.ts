import { getOcrProviderDefinition } from "../../config/providers.js";
import {
  credentialOcrToken,
} from "./selectors-port.js";
import { defaultCredentialsStatePort } from "./default-state-port.js";
import { runOcrTokenValidation } from "./validation.js";

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
}: any) {
  const definition = getOcrProviderDefinition(providerId);

  if (!definition.supportsValidation) {
    // 自托管 / 免凭据 provider（如 local）：无需 token 即视为就绪。
    return {
      ok: true,
      status: "not_required",
      definition,
      token: "",
      result: null,
    };
  }

  const token = credentialOcrToken(credentials, {
    providerId: definition.id,
    defaultPaddleToken,
  }).trim();

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
