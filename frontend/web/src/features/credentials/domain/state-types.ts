import type {
  Store,
  StoreListener,
} from "@/platform/store/store.js";

export interface CredentialsFields {
  ocrProvider: string;
  ocrCredentialRef: string;
  paddleToken: string;
  mineruToken?: string;
  glmOcrToken?: string;
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
  providerId?: string;
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
