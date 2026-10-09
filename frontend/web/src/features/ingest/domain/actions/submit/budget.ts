import { withTimeout } from "@/platform/utils/async-timeout.js";
import {
  DEEPSEEK_BALANCE_CHECK_TIMEOUT_MS,
  type EnsureDeepSeekBudgetReadyOptions,
  type NeedsDeepSeekBudgetCheckOptions,
} from "./contracts.js";
import { asBalanceResult, asBudgetState } from "./normalizers.js";

export function needsDeepSeekBudgetCheck({
  workflow,
  workflowNeedsUpload,
  currentBudgetState,
}: NeedsDeepSeekBudgetCheckOptions = {}) {
  const budget = asBudgetState(currentBudgetState?.());
  return Boolean(workflowNeedsUpload?.(workflow)) && Boolean(budget?.visible);
}

export async function ensureDeepSeekBudgetReady({
  workflow,
  workflowNeedsUpload,
  currentBudgetState,
  refreshDeepSeekBalance,
  setText,
  timeoutMs = DEEPSEEK_BALANCE_CHECK_TIMEOUT_MS,
}: EnsureDeepSeekBudgetReadyOptions) {
  if (!needsDeepSeekBudgetCheck({ workflow, workflowNeedsUpload, currentBudgetState })) {
    return true;
  }
  setText("error-box", "正在检测 DeepSeek 余额…");
  try {
    const result = asBalanceResult(await withTimeout(
      refreshDeepSeekBalance?.({ silent: true }) || Promise.resolve(null),
      timeoutMs,
      "DeepSeek 余额检测超时，请稍后重试或在接口设置中检测。",
    ));
    if (result?.status === "missing_key") {
      setText("error-box", "请先填写 DeepSeek API Key。");
      return false;
    }
    if (result?.status === "network_error") {
      setText("error-box", "DeepSeek 余额检测失败，请稍后重试或在接口设置中检测。");
      return false;
    }
  } catch (error) {
    setText("error-box", (error as { message?: string })?.message || "DeepSeek 余额检测失败，请稍后重试。");
    return false;
  }
  const budget = asBudgetState(currentBudgetState?.());
  if (budget?.blocking) {
    setText("error-box", `余额不足：${budget.message}。请充值后再提交。`);
    return false;
  }
  if (budget?.visible && !budget.balanceChecked) {
    setText("error-box", "无法确认 DeepSeek 余额，请先在接口设置中完成检测。");
    return false;
  }
  return true;
}
