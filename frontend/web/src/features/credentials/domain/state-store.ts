import { createStore } from "@/platform/store/store.js";
import { DEFAULT_OCR_PROVIDER } from "@/platform/config/providers.js";
import { normalizeBrowserStoredConfig } from "@/platform/config/storage.js";
import type {
  CredentialsActions,
  CredentialsFields,
  CredentialsInitialState,
  CredentialsRuntime,
  CredentialsState,
  CredentialsStore,
  OcrValidationCache,
  OcrValidationCachePayload,
} from "./state-types.js";

function normalizeCredentials(payload: Partial<CredentialsFields> = {}): CredentialsFields {
  return normalizeBrowserStoredConfig({
    ocrProvider: payload.ocrProvider || DEFAULT_OCR_PROVIDER,
    ocrCredentialRef: payload.ocrCredentialRef,
    paddleToken: payload.paddleToken,
    mineruToken: payload.mineruToken,
    glmOcrToken: payload.glmOcrToken,
    translationCredentialRef: payload.translationCredentialRef,
    modelApiKey: payload.modelApiKey,
  }) as CredentialsFields;
}

function normalizeBalance(balanceCny: unknown): number | null {
  const value = Number(balanceCny);
  return Number.isFinite(value) ? value : null;
}

function normalizeOcrValidation(payload: OcrValidationCachePayload = {}): OcrValidationCache {
  return {
    provider: `${payload.provider || ""}`.trim(),
    token: `${payload.token || ""}`.trim(),
    status: `${payload.status || ""}`.trim(),
  };
}

function normalizeRuntime(payload: Partial<CredentialsRuntime> & {
  deepseekBalanceCny?: unknown;
  deepseekBalanceChecked?: unknown;
  ocrValidation?: OcrValidationCachePayload;
} = {}): CredentialsRuntime {
  return {
    deepseekBalanceCny: normalizeBalance(payload.deepseekBalanceCny),
    deepseekBalanceChecked: Boolean(payload.deepseekBalanceChecked),
    ocrValidation: normalizeOcrValidation(payload.ocrValidation),
  };
}

function resolveInitialCredentials(initialState: CredentialsInitialState = {}): CredentialsFields {
  const nested = (initialState as Partial<CredentialsState>).credentials;
  return normalizeCredentials(nested || (initialState as Partial<CredentialsFields>));
}

function resolveInitialRuntime(initialState: CredentialsInitialState = {}): CredentialsRuntime {
  const nested = (initialState as Partial<CredentialsState>).runtime;
  return normalizeRuntime(nested || (initialState as Partial<CredentialsRuntime>));
}

export function createCredentialsStore(
  initialState: CredentialsInitialState = {},
): CredentialsStore {
  return createStore<CredentialsState, CredentialsActions>({
    name: "credentials",
    initialState: {
      credentials: resolveInitialCredentials(initialState),
      runtime: resolveInitialRuntime(initialState),
    },
    actions: {
      setCredentials(currentState, payload = {}) {
        return {
          ...currentState,
          credentials: normalizeCredentials(payload),
        };
      },
      patchCredentials(currentState, payload = {}) {
        return {
          ...currentState,
          credentials: normalizeCredentials({
            ...currentState.credentials,
            ...payload,
          }),
        };
      },
      resetDeepSeekBalance(currentState) {
        return {
          ...currentState,
          runtime: {
            ...currentState.runtime,
            deepseekBalanceCny: null,
            deepseekBalanceChecked: false,
          },
        };
      },
      setDeepSeekBalance(currentState, { balanceCny, checked = true } = {}) {
        return {
          ...currentState,
          runtime: {
            ...currentState.runtime,
            deepseekBalanceCny: normalizeBalance(balanceCny),
            deepseekBalanceChecked: Boolean(checked),
          },
        };
      },
      resetOcrValidationCache(currentState) {
        return {
          ...currentState,
          runtime: {
            ...currentState.runtime,
            ocrValidation: normalizeOcrValidation(),
          },
        };
      },
      setOcrValidationCache(currentState, payload = {}) {
        return {
          ...currentState,
          runtime: {
            ...currentState.runtime,
            ocrValidation: normalizeOcrValidation(payload),
          },
        };
      },
    },
  });
}
