import {
  getTranslationProviderDefinition,
  inferTranslationProvider,
  isOfficialDeepSeekBaseUrl,
  TRANSLATION_PROVIDER_DEFINITION,
} from "@/platform/config/providers.js";
import {
  runDeepSeekBalanceCheck,
  runDeepSeekConnectivityCheck,
  summarizeDeepSeekBalance,
} from "./validation.js";
import type {
  ProviderValidationResult,
  RunDeepSeekBalanceCheckOptions,
  RunDeepSeekConnectivityCheckOptions,
} from "./validation.js";
import { defaultCredentialsStatePort } from "./default-state-port.js";
import type { CredentialDialogElementsLike } from "./dialog-values.js";
import type { CredentialsFields, CredentialsStatePort } from "./state.js";

const DEEPSEEK_LOW_BALANCE_THRESHOLD = 2;

function translationApiLabel(baseUrl = "") {
  if (!`${baseUrl || ""}`.trim()) return "DeepSeek";
  const provider = inferTranslationProvider(baseUrl);
  return provider === "custom"
    ? "翻译接口"
    : getTranslationProviderDefinition(provider).label;
}

// 低余额提示的阈值是「2 元」，所以只能拿人民币档去比。此前这里把
// balance_infos 里所有币种的 total_balance 直接相加（CNY + USD 混算），
// 既可能把 1 CNY + 1.5 USD 凑成 2.5 判成余额充足，也可能在只有 USD 时
// 用美元数额去比人民币阈值。改成只累加 CNY；没有 CNY 档时返回 null，
// 由调用方跳过阈值判断而不是拿一个错的数去比。
function deepSeekCnyBalance(result: ProviderValidationResult): number | null {
  const infos = Array.isArray(result?.balance_infos) ? result.balance_infos : [];
  let total = 0;
  let matched = false;
  for (const item of infos) {
    if (`${item?.currency ?? ""}`.trim().toUpperCase() !== "CNY") continue;
    const raw = `${item?.total_balance ?? ""}`.replace(/[^\d.-]/g, "");
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) continue;
    total += value;
    matched = true;
  }
  return matched ? total : null;
}

export async function handleBrowserDeepSeekValidate({
  apiPrefix,
  state,
  defaultModelApiKey,
  validateDeepSeekToken,
  queryDeepSeekBalance,
  onBalanceChange,
  silent = false,
  credentialsStatePort = defaultCredentialsStatePort,
  viewPort,
}: {
  apiPrefix: string;
  state?: unknown;
  defaultModelApiKey?: () => string;
  validateDeepSeekToken: RunDeepSeekConnectivityCheckOptions["validateDeepSeekToken"];
  queryDeepSeekBalance?: RunDeepSeekBalanceCheckOptions["queryDeepSeekBalance"];
  onBalanceChange?: () => void;
  silent?: boolean;
  credentialsStatePort?: CredentialsStatePort;
  legacyRuntimePort?: unknown;
  viewPort: {
    elements: () => CredentialDialogElementsLike;
    setTopUpVisible: (visible?: boolean) => void;
    setValidationMessage: (message?: string, tone?: string) => void;
  };
}) {
  const {
    apiKeyInput,
    modelBaseUrlInput,
    modelNameInput,
  } = viewPort.elements();
  const storedCredentials: Partial<CredentialsFields> = credentialsStatePort.getCredentials?.() || {};
  const modelApiKey = apiKeyInput?.value?.trim()
    || `${storedCredentials.modelApiKey || ""}`.trim()
    || defaultModelApiKey?.()
    || "";
  const baseUrl = modelBaseUrlInput?.value?.trim() || "";
  // 模型名必须一起送去检测：探针走 /chat/completions，没有模型名就只能验 Key，
  // 用户填错模型时会拿到一个假绿灯，真正翻译才失败。
  //
  // 模型名的真值只有这个输入框：它不在 credentials 里（那里只有 modelApiKey /
  // translationCredentialRef），而是存在 taskOptions.model，开面板时由
  // dialog-sync 回填进本框。所以这里不做"从已存凭据兜底"——那个字段不存在。
  const modelName = modelNameInput?.value?.trim() || "";
  // 空模型名时后端只能退回 /models 连通性探针。这仍是有用的检测，但覆盖面
  // 小于用户以为的"接口可用"，成功文案必须如实标注，不能给一个含糊的绿灯。
  const modelScopeNote = modelName ? "" : "（未验证模型）";
  const providerLabel = translationApiLabel(baseUrl);
  credentialsStatePort.resetDeepSeekBalance?.();
  onBalanceChange?.();
  if (!modelApiKey) {
    if (!silent && storedCredentials.translationCredentialRef) {
      viewPort.setValidationMessage("翻译 API 使用旧配置；请填写 Key 后检测", "");
    }
    return { ok: false, status: "missing_key" };
  }
  viewPort.setTopUpVisible(false);
  if (!silent) {
    viewPort.setValidationMessage(
      providerLabel === "DeepSeek" ? "正在检测 DeepSeek 和余额…" : "正在检测翻译接口…",
      "pending",
    );
  }
  const result = await runDeepSeekConnectivityCheck({
    apiPrefix,
    apiKey: modelApiKey,
    baseUrl,
    model: modelName,
    validateDeepSeekToken,
    setDeepSeekValidationMessage: viewPort.setValidationMessage,
    showResult: false,
  });
  if (result.ok) {
    if (!isOfficialDeepSeekBaseUrl(baseUrl)) {
      viewPort.setTopUpVisible(false);
      if (!silent) {
        viewPort.setValidationMessage(
          `${providerLabel === "翻译接口" ? "翻译接口可用" : `${providerLabel} 可用`}${modelScopeNote}`,
          "valid",
        );
      }
      return { ...result, status: "unsupported_provider" };
    }
    const balance = await runDeepSeekBalanceCheck({
      apiPrefix,
      apiKey: modelApiKey,
      baseUrl,
      queryDeepSeekBalance,
    });
    if (balance.status === "unsupported_provider") {
      if (!silent) {
        viewPort.setValidationMessage(`${providerLabel} 可用${modelScopeNote}`, "valid");
      }
      return balance;
    }
    if (balance.status === "network_error") {
      if (!silent) {
        viewPort.setValidationMessage(`${providerLabel} 可用${modelScopeNote}，余额查询失败`, "valid");
      }
      return balance;
    }
    const balanceSummary = summarizeDeepSeekBalance(balance);
    const cnyBalance = deepSeekCnyBalance(balance);
    // 余额本身是真值，silent 与否都要落库供上传门禁读取。
    credentialsStatePort.setDeepSeekBalance?.(cnyBalance ?? 0, true);
    onBalanceChange?.();
    // 没有 CNY 档时无从判断是否低于 2 元，不猜、不提示充值。
    const shouldTopUp = cnyBalance !== null && cnyBalance < DEEPSEEK_LOW_BALANCE_THRESHOLD;
    // 下面两处是**面向用户的可见输出**，必须守 silent：refreshDeepSeekBalance
    // 默认 silent=true 且在后台调用，此前这里没守，会把用户刚点「检测接口」
    // 看到的结果悄悄改写掉（本分支是唯一漏守的，其余分支都守了）。
    if (!silent) {
      viewPort.setTopUpVisible(shouldTopUp);
      viewPort.setValidationMessage(
        `${providerLabel} 可用${modelScopeNote}，${balanceSummary}${shouldTopUp ? "，余额低于 2 元" : ""}`,
        balance.is_available ? "valid" : "error",
      );
    }
    return balance;
  }
  viewPort.setTopUpVisible(false);
  if (!silent) {
    viewPort.setValidationMessage(
      result.summary || TRANSLATION_PROVIDER_DEFINITION.validationNetworkMessage,
      "error",
    );
  }
  return result;
}
