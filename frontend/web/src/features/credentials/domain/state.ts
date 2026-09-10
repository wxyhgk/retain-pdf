import {
  createStore,
  type BoundStoreActions,
  type Store,
  type StoreListener,
} from "@/platform/store/store.js";
import { DEFAULT_OCR_PROVIDER } from "@/platform/config/providers.js";
import { normalizeBrowserStoredConfig } from "@/platform/config/storage.js";

export interface CredentialsFields {
  ocrProvider: string;
  ocrCredentialRef: string;
  paddleToken: string;
  translationCredentialRef: string;
  modelApiKey: string;
}

export interface OcrValidationCache {
  provider: string;
  token: string;
  status: string;
}

export interface CredentialsRuntime {
  deepseekBalanceCny: number | null;
  deepseekBalanceChecked: boolean;
  ocrValidation: OcrValidationCache;
}

export interface CredentialsState {
  credentials: CredentialsFields;
  runtime: CredentialsRuntime;
}

export interface DeepSeekBalanceState {
  balanceCny: number | null;
  balanceChecked: boolean;
}

export interface OcrTokenOptions {
  defaultPaddleToken?: () => string;
}

export interface OcrValidationCachePayload {
  provider?: string;
  token?: string;
  status?: string;
}

export interface HasValidOcrValidationCacheOptions {
  provider?: string;
  token?: string;
  statuses?: string[];
}

export type CredentialsInitialState =
  | Partial<CredentialsState>
  | Partial<CredentialsFields & CredentialsRuntime>
  | Partial<CredentialsFields>;

export interface CreateCredentialsStatePortOptions {
  initialState?: CredentialsInitialState;
  mirrorToDom?: (credentials: CredentialsFields) => void;
  mirrorRuntime?: (runtime: CredentialsRuntime) => void;
}

export type CredentialsActions = {
  setCredentials(
    currentState: CredentialsState,
    payload?: Partial<CredentialsFields>,
  ): CredentialsState;
  patchCredentials(
    currentState: CredentialsState,
    payload?: Partial<CredentialsFields>,
  ): CredentialsState;
  resetDeepSeekBalance(currentState: CredentialsState): CredentialsState;
  setDeepSeekBalance(
    currentState: CredentialsState,
    payload?: { balanceCny?: unknown; checked?: boolean },
  ): CredentialsState;
  resetOcrValidationCache(currentState: CredentialsState): CredentialsState;
  setOcrValidationCache(
    currentState: CredentialsState,
    payload?: OcrValidationCachePayload,
  ): CredentialsState;
};

export type CredentialsStore = Store<CredentialsState, CredentialsActions>;

export interface CredentialsStatePort {
  getDeepSeekBalanceState(): DeepSeekBalanceState;
  getCredentials(): CredentialsFields;
  getOcrToken(options?: OcrTokenOptions): string;
  getRuntime(): CredentialsRuntime;
  getSnapshot(): CredentialsState;
  hasComplete(options?: OcrTokenOptions): boolean;
  hasValidOcrValidationCache(options?: HasValidOcrValidationCacheOptions): boolean;
  patchCredentials(payload?: Partial<CredentialsFields>): CredentialsFields;
  resetDeepSeekBalance(): DeepSeekBalanceState;
  resetOcrValidationCache(): OcrValidationCache;
  setCredentials(payload?: Partial<CredentialsFields>): CredentialsFields;
  setDeepSeekBalance(balanceCny: unknown, checked?: boolean): DeepSeekBalanceState;
  setOcrValidationCache(payload?: OcrValidationCachePayload): OcrValidationCache;
  subscribe(listener: StoreListener<CredentialsState>): () => void;
  store: CredentialsStore;
}

function normalizeCredentials(payload: Partial<CredentialsFields> = {}): CredentialsFields {
  return normalizeBrowserStoredConfig({
    ocrProvider: payload.ocrProvider || DEFAULT_OCR_PROVIDER,
    ocrCredentialRef: payload.ocrCredentialRef,
    paddleToken: payload.paddleToken,
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

export function ocrTokenFromCredentials(
  credentials: Partial<CredentialsFields> = {},
  { defaultPaddleToken }: OcrTokenOptions = {},
): string {
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
  return Boolean(
    (credentials.ocrCredentialRef || ocrTokenFromCredentials(credentials, options))
    && credentials.translationCredentialRef,
  );
}

export function createCredentialsStatePort({
  initialState = {},
  mirrorToDom,
  mirrorRuntime,
}: CreateCredentialsStatePortOptions = {}): CredentialsStatePort {
  const store = createCredentialsStore(initialState);
  const actions: BoundStoreActions<CredentialsState, CredentialsActions> = store.actions;

  function getSnapshot(): CredentialsState {
    return store.getSnapshot();
  }

  function getCredentials(): CredentialsFields {
    return getSnapshot().credentials;
  }

  function getRuntime(): CredentialsRuntime {
    return getSnapshot().runtime;
  }

  function setCredentials(payload: Partial<CredentialsFields> = {}): CredentialsFields {
    const snapshot = actions.setCredentials(payload);
    mirrorToDom?.(snapshot.credentials);
    return snapshot.credentials;
  }

  function patchCredentials(payload: Partial<CredentialsFields> = {}): CredentialsFields {
    const snapshot = actions.patchCredentials(payload);
    mirrorToDom?.(snapshot.credentials);
    return snapshot.credentials;
  }

  function getOcrToken(options: OcrTokenOptions = {}): string {
    return ocrTokenFromCredentials(getCredentials(), options);
  }

  function hasComplete(options: OcrTokenOptions = {}): boolean {
    return hasCompleteCredentials(getCredentials(), options);
  }

  function getDeepSeekBalanceState(): DeepSeekBalanceState {
    const runtime = getRuntime();
    return {
      balanceCny: runtime.deepseekBalanceCny,
      balanceChecked: Boolean(runtime.deepseekBalanceChecked),
    };
  }

  function resetDeepSeekBalance(): DeepSeekBalanceState {
    const snapshot = actions.resetDeepSeekBalance();
    mirrorRuntime?.(snapshot.runtime);
    return getDeepSeekBalanceState();
  }

  function setDeepSeekBalance(balanceCny: unknown, checked = true): DeepSeekBalanceState {
    const snapshot = actions.setDeepSeekBalance({ balanceCny, checked });
    mirrorRuntime?.(snapshot.runtime);
    return getDeepSeekBalanceState();
  }

  function resetOcrValidationCache(): OcrValidationCache {
    const snapshot = actions.resetOcrValidationCache();
    mirrorRuntime?.(snapshot.runtime);
    return snapshot.runtime.ocrValidation;
  }

  function setOcrValidationCache(payload: OcrValidationCachePayload = {}): OcrValidationCache {
    const snapshot = actions.setOcrValidationCache(payload);
    mirrorRuntime?.(snapshot.runtime);
    return snapshot.runtime.ocrValidation;
  }

  function hasValidOcrValidationCache({
    provider = "",
    token = "",
    statuses = ["valid", "skipped"],
  }: HasValidOcrValidationCacheOptions = {}): boolean {
    const validation = getRuntime().ocrValidation;
    return validation.provider === `${provider || ""}`.trim()
      && validation.token === `${token || ""}`.trim()
      && statuses.includes(validation.status);
  }

  return {
    getDeepSeekBalanceState,
    getCredentials,
    getOcrToken,
    getRuntime,
    getSnapshot,
    hasComplete,
    hasValidOcrValidationCache,
    patchCredentials,
    resetDeepSeekBalance,
    resetOcrValidationCache,
    setCredentials,
    setDeepSeekBalance,
    setOcrValidationCache,
    subscribe: store.subscribe,
    store,
  };
}
