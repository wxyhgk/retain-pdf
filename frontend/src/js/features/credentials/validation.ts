import {
  getOcrProviderDefinition,
  TRANSLATION_PROVIDER_DEFINITION,
} from "../../config/providers.js";
import type {
  CredentialsStatePort,
  OcrValidationCachePayload,
} from "./state.js";

export interface ProviderValidationResult {
  ok?: boolean;
  status?: string | number;
  summary?: string;
  operator_hint?: string;
  balance_infos?: Array<{
    currency?: string;
    total_balance?: string;
  }>;
  is_available?: boolean;
}

export interface CredentialsStatePortLike {
  resetOcrValidationCache?: () => unknown;
  setOcrValidationCache?: (payload?: OcrValidationCachePayload) => unknown;
}

export interface ResetOcrValidationRuntimeOptions {
  credentialsStatePort?: CredentialsStatePortLike | CredentialsStatePort;
  state?: unknown;
  legacyRuntimePort?: unknown;
}

export interface SetOcrValidationRuntimeOptions extends ResetOcrValidationRuntimeOptions {}

export interface RunOcrTokenValidationOptions {
  apiPrefix?: string;
  state?: unknown;
  credentialsStatePort?: CredentialsStatePortLike | CredentialsStatePort;
  providerId?: string;
  token?: string;
  validateOcrToken?: (
    apiPrefix?: unknown,
    providerId?: unknown,
    token?: unknown,
  ) => Promise<ProviderValidationResult | unknown> | ProviderValidationResult | unknown;
  setOcrValidationMessage?: (message?: string, tone?: string, providerId?: string) => void;
  showResult?: boolean;
  legacyRuntimePort?: unknown;
}

export interface RunDeepSeekConnectivityCheckOptions {
  apiPrefix?: string;
  apiKey?: string;
  baseUrl?: string;
  validateDeepSeekToken?: (
    apiPrefix?: unknown,
    payload?: unknown,
  ) => Promise<ProviderValidationResult | unknown> | ProviderValidationResult | unknown;
  setDeepSeekValidationMessage?: (message?: string, tone?: string) => void;
  showResult?: boolean;
}

export interface RunDeepSeekBalanceCheckOptions {
  apiPrefix?: string;
  apiKey?: string;
  baseUrl?: string;
  queryDeepSeekBalance?: (
    apiPrefix?: unknown,
    payload?: unknown,
  ) => Promise<ProviderValidationResult | unknown> | ProviderValidationResult | unknown;
}

function resetOcrValidationRuntime({
  credentialsStatePort,
}: ResetOcrValidationRuntimeOptions = {}) {
  credentialsStatePort?.resetOcrValidationCache?.();
}

function setOcrValidationRuntime(
  { credentialsStatePort }: SetOcrValidationRuntimeOptions,
  payload: OcrValidationCachePayload = {},
) {
  credentialsStatePort?.setOcrValidationCache?.(payload);
}

function asValidationResult(value: unknown): ProviderValidationResult {
  if (value && typeof value === "object") {
    return value as ProviderValidationResult;
  }
  return {};
}

export async function runOcrTokenValidation({
  apiPrefix,
  state,
  credentialsStatePort,
  providerId,
  token,
  validateOcrToken,
  setOcrValidationMessage,
  showResult = true,
  legacyRuntimePort,
}: RunOcrTokenValidationOptions) {
  const definition = getOcrProviderDefinition(providerId);
  const normalizedToken = `${token || ""}`.trim();
  if (!normalizedToken) {
    resetOcrValidationRuntime({ state, credentialsStatePort, legacyRuntimePort });
    if (showResult) {
      setOcrValidationMessage(definition.validationMissingMessage, "error", definition.id);
    }
    return { ok: false, status: "unauthorized" };
  }
  if (!definition.supportsValidation) {
    setOcrValidationRuntime({ state, credentialsStatePort, legacyRuntimePort }, {
      provider: definition.id,
      token: normalizedToken,
      status: "skipped",
    });
    if (showResult) {
      setOcrValidationMessage(definition.validationUnavailableMessage, "", definition.id);
    }
    return {
      ok: true,
      status: "skipped",
      summary: definition.validationUnavailableMessage,
    };
  }
  if (showResult) {
    setOcrValidationMessage(`Dang kiem tra ${definition.label} Token...`, "", definition.id);
  }
  try {
    const result = asValidationResult(await validateOcrToken(apiPrefix, definition.id, normalizedToken));
    setOcrValidationRuntime({ state, credentialsStatePort, legacyRuntimePort }, {
      provider: definition.id,
      token: normalizedToken,
      status: `${result.status || ""}`,
    });
    if (showResult) {
      const hint = result.operator_hint ? ` ${result.operator_hint}` : "";
      const message = result.summary || `Ket qua kiem tra ${definition.label} Token: ${result.status || "unknown"}`;
      setOcrValidationMessage(`${message}${hint}`.trim(), result.ok ? "valid" : "error", definition.id);
    }
    return result;
  } catch (_err) {
    resetOcrValidationRuntime({ state, credentialsStatePort, legacyRuntimePort });
    if (showResult) {
      setOcrValidationMessage(`Kiem tra ${definition.label} Token that bai. Hay thu lai sau.`, "error", definition.id);
    }
    return {
      ok: false,
      status: "network_error",
      summary: `Kiem tra ${definition.label} Token that bai. Hay thu lai sau.`,
    };
  }
}

export async function runDeepSeekConnectivityCheck({
  apiPrefix,
  apiKey,
  baseUrl,
  validateDeepSeekToken,
  setDeepSeekValidationMessage,
  showResult = true,
}: RunDeepSeekConnectivityCheckOptions) {
  const modelApiKey = `${apiKey || ""}`.trim();
  const modelBaseUrl = `${baseUrl || ""}`.trim();
  if (!modelApiKey) {
    if (showResult) {
      setDeepSeekValidationMessage(TRANSLATION_PROVIDER_DEFINITION.validationMissingMessage, "error");
    }
    return { ok: false, status: 0 };
  }
  if (showResult) {
    setDeepSeekValidationMessage("Dang kiem tra API DeepSeek...");
  }
  try {
    const result = asValidationResult(await validateDeepSeekToken(apiPrefix, {
      api_key: modelApiKey,
      base_url: modelBaseUrl,
    }));
    if (showResult) {
      setDeepSeekValidationMessage(
        result.summary || (result.ok
          ? TRANSLATION_PROVIDER_DEFINITION.validationSuccessMessage
          : TRANSLATION_PROVIDER_DEFINITION.validationNetworkMessage),
        result.ok ? "valid" : "error",
      );
    }
    return result;
  } catch (_err) {
    if (showResult) {
      setDeepSeekValidationMessage(TRANSLATION_PROVIDER_DEFINITION.validationNetworkMessage, "error");
    }
    return { ok: false, status: 0 };
  }
}

export function summarizeDeepSeekBalance(result) {
  const infos = Array.isArray(result?.balance_infos) ? result.balance_infos : [];
  const parts = infos
    .filter((item) => item && item.currency && item.total_balance)
    .map((item) => `${item.currency} ${item.total_balance}`);
  if (parts.length > 0) {
    return `So du ${parts.join(", ")}`;
  }
  if (result?.is_available) {
    return "So du kha dung";
  }
  return "So du khong du";
}

export async function runDeepSeekBalanceCheck({
  apiPrefix,
  apiKey,
  baseUrl,
  queryDeepSeekBalance,
}: RunDeepSeekBalanceCheckOptions) {
  const modelApiKey = `${apiKey || ""}`.trim();
  const modelBaseUrl = `${baseUrl || ""}`.trim();
  if (!modelApiKey) {
    return { ok: false, status: "missing_key" };
  }
  if (!queryDeepSeekBalance) {
    return { ok: false, status: "unsupported" };
  }
  try {
    return asValidationResult(await queryDeepSeekBalance(apiPrefix, {
      api_key: modelApiKey,
      base_url: modelBaseUrl,
    }));
  } catch (_err) {
    return { ok: false, status: "network_error" };
  }
}
