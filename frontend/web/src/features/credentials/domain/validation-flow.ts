// 凭据校验触发：OCR 检测、翻译 Key 检测/余额刷新、上传前 OCR 就绪。
// 多为对下层流程的薄转发；集中于此让 browser.ts 只做装配。

import { runOcrTokenValidation } from "./validation.js";
import type {
  ProviderValidationResult,
  RunDeepSeekBalanceCheckOptions,
  RunDeepSeekConnectivityCheckOptions,
  RunOcrTokenValidationOptions,
} from "./validation.js";
import { getOcrProviderDefinition } from "@/platform/config/providers.js";
import { handleBrowserDeepSeekValidate as runBrowserDeepSeekValidate } from "./deepseek-flow.js";
import { ensureOcrCredentialValidationReady } from "./ocr-readiness-flow.js";
import {
  ocrTokenFromDialogValues,
  readCredentialDialogValues,
} from "./dialog-values.js";
import type { CredentialDialogElementsLike } from "./dialog-values.js";
import type {
  CredentialsFields,
  CredentialsStatePort,
} from "./state.js";

type CredentialAccess = {
  readCurrentCredentials: () => CredentialsFields;
  currentOcrProvider: () => string;
};

type ValidationViewPort = {
  setOcrValidationMessage: (message?: string, tone?: string, providerId?: string) => void;
};

type DeepSeekViewPort = {
  elements: () => CredentialDialogElementsLike;
  setTopUpVisible: (visible?: boolean) => void;
  setValidationMessage: (message?: string, tone?: string) => void;
};

export interface EnsureOcrReadyOptions {
  onMissingToken?: () => void;
  onInvalidToken?: (result?: ProviderValidationResult | null) => void;
}

export function createCredentialValidationFlow({
  apiPrefix,
  state,
  viewPort,
  deepSeekViewPort,
  access,
  dialogElementsPort,
  validateOcrToken,
  validateDeepSeekToken,
  queryDeepSeekBalance,
  defaultPaddleToken,
  defaultModelApiKey,
  onCredentialStateChange,
  credentialsStatePort,
  runtimeEnv,
  legacyRuntimePort,
  legacyValidationCachePort,
}: {
  apiPrefix: string;
  state?: unknown;
  viewPort: ValidationViewPort;
  deepSeekViewPort: DeepSeekViewPort;
  access: CredentialAccess;
  dialogElementsPort: { elements: () => CredentialDialogElementsLike };
  validateOcrToken: RunOcrTokenValidationOptions["validateOcrToken"];
  validateDeepSeekToken: RunDeepSeekConnectivityCheckOptions["validateDeepSeekToken"];
  queryDeepSeekBalance?: RunDeepSeekBalanceCheckOptions["queryDeepSeekBalance"];
  defaultPaddleToken?: () => string;
  defaultModelApiKey?: () => string;
  onCredentialStateChange?: () => void;
  credentialsStatePort: CredentialsStatePort;
  runtimeEnv: { isDesktopMode: () => boolean };
  legacyRuntimePort?: unknown;
  legacyValidationCachePort?: unknown;
}) {
  async function ensureOcrReady({
    onMissingToken,
    onInvalidToken,
  }: EnsureOcrReadyOptions = {}) {
    const provider = access.currentOcrProvider();
    const readiness = await ensureOcrCredentialValidationReady({
      apiPrefix,
      state,
      providerId: provider,
      credentials: access.readCurrentCredentials(),
      defaultPaddleToken,
      validateOcrToken,
      setOcrValidationMessage: viewPort.setOcrValidationMessage,
      showResult: !runtimeEnv.isDesktopMode(),
      credentialsStatePort,
      legacyRuntimePort,
      legacyValidationCachePort,
    });
    if (readiness.status === "missing_token") {
      onMissingToken?.();
      viewPort.setOcrValidationMessage(readiness.definition.validationMissingMessage, "error", readiness.definition.id);
      return false;
    }
    if (readiness.ok) {
      return true;
    }
    onInvalidToken?.(readiness.result);
    return false;
  }

  async function handleOcrValidate() {
    const provider = access.currentOcrProvider();
    const token = ocrTokenFromDialogValues(
      readCredentialDialogValues({ elementsPort: dialogElementsPort }),
      provider,
    );
    if (!token && access.readCurrentCredentials().ocrCredentialRef) {
      viewPort.setOcrValidationMessage(
        `${getOcrProviderDefinition(provider).label} 使用旧配置；请填写 Token 后检测`,
        "",
        provider,
      );
      return;
    }
    await runOcrTokenValidation({
      apiPrefix,
      state,
      providerId: provider,
      token,
      validateOcrToken,
      setOcrValidationMessage: viewPort.setOcrValidationMessage,
      showResult: true,
      credentialsStatePort,
      legacyRuntimePort,
    });
  }

  async function handleDeepSeekValidate() {
    await runBrowserDeepSeekValidate({
      apiPrefix,
      state,
      defaultModelApiKey,
      validateDeepSeekToken,
      queryDeepSeekBalance,
      onBalanceChange: onCredentialStateChange,
      credentialsStatePort,
      legacyRuntimePort,
      viewPort: deepSeekViewPort,
    });
  }

  async function refreshDeepSeekBalance({ silent = true }: { silent?: boolean } = {}) {
    return runBrowserDeepSeekValidate({
      apiPrefix,
      state,
      defaultModelApiKey,
      validateDeepSeekToken,
      queryDeepSeekBalance,
      onBalanceChange: onCredentialStateChange,
      silent,
      credentialsStatePort,
      legacyRuntimePort,
      viewPort: deepSeekViewPort,
    });
  }

  return { ensureOcrReady, handleOcrValidate, handleDeepSeekValidate, refreshDeepSeekBalance };
}
