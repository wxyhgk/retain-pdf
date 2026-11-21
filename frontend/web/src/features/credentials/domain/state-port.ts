import type { BoundStoreActions } from "@/platform/store/store.js";
import { createCredentialsStore } from "./state-store.js";
import {
  hasCompleteCredentials,
  ocrReadyFor,
  ocrTokenFromCredentials,
} from "./state-selectors.js";
import type {
  CreateCredentialsStatePortOptions,
  CredentialsActions,
  CredentialsFields,
  CredentialsRuntime,
  CredentialsState,
  CredentialsStatePort,
  DeepSeekBalanceState,
  HasValidOcrValidationCacheOptions,
  OcrTokenOptions,
  OcrValidationCache,
  OcrValidationCachePayload,
} from "./state-types.js";

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

  function isOcrReady(options: OcrTokenOptions = {}): boolean {
    return ocrReadyFor(getCredentials(), options);
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
    isOcrReady,
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
