// 提交前的两道 provider 预检：DeepSeek 余额、OCR Provider Token。
//
// 它们以前挡在 submitJobRequest 前面，各自是一次第三方网络往返（余额检测的超时
// 上限是 12 秒），而 OCR 校验缓存是纯内存的（getRuntime().ocrValidation，无 TTL、
// 不跨刷新），所以每次刷新页面后的第一次提交都要重新走一遍全程——用户点「直接
// 翻译」之后要干等，任务迟迟不落盘。
//
// 现在改成点击时并行发起、不挡提交。安全性由这一点保证：「压根没填凭据」本来就
// 由本地的 resolveSubmitReadiness 拦着（纯内存判断，不走网络），这两道只覆盖
// 「填了但无效 / 余额不够」。它们从「提交前的闸」降级成「任务已排队，顺带提前
// 告诉你一声」——否则同样的问题要等流水线真跑到那一步才报。
//
// 结果不再写 error-box：提交成功后弹窗会关掉并跳到书籍详情，error-box 那时已经
// 不在屏上。改为经 notify 端口报出（composition 接的是 toast）。

import { ensureDeepSeekBudgetReady } from "./budget.js";
import { ensureOcrCredentialsForSubmit } from "./credentials.js";

export type SubmitPreflightOptions = {
  workflow?: string;
  desktopMode?: boolean;
  workflowNeedsUpload?: (workflow?: string) => boolean | unknown;
  workflowNeedsCredentials?: (workflow?: string) => boolean | unknown;
  currentBudgetState?: (workflow?: string) => unknown;
  refreshDeepSeekBalance?: (options?: unknown) => unknown;
  ensureOcrCredentialsReady?: (options?: unknown) => unknown;
  /** 预检失败时报给用户（composition 接 toast）。不传则静默。 */
  notifyPreflightWarning?: (message: string) => void;
};

/**
 * 并行跑两道预检，永不抛错、永不阻塞调用方。
 *
 * 两道检查内部都用 setText("error-box", …) 写失败原因，这里给它们一个只捕获
 * 文案的 shim，再转交 notifyPreflightWarning —— 不改它们的签名，也不让它们
 * 去写一个已经关掉的弹窗上的元素。
 */
export function startSubmitPreflight({
  workflow,
  desktopMode,
  workflowNeedsUpload,
  workflowNeedsCredentials,
  currentBudgetState,
  refreshDeepSeekBalance,
  ensureOcrCredentialsReady,
  notifyPreflightWarning,
}: SubmitPreflightOptions = {}): Promise<void> {
  const warn = (message: string) => {
    const text = `${message || ""}`.trim();
    // "-" 是 error-box 的清空约定，不是给人看的内容。
    if (!text || text === "-") return;
    try {
      notifyPreflightWarning?.(text);
    } catch {
      // 通知失败不得影响已经提交出去的任务。
    }
  };
  const captureText = (_id: string, value?: unknown) => { warn(`${value ?? ""}`); };

  const budget = Promise.resolve()
    .then(() => ensureDeepSeekBudgetReady({
      workflow,
      workflowNeedsUpload,
      currentBudgetState,
      refreshDeepSeekBalance,
      setText: captureText,
    }))
    .catch(() => false);

  const credentials = Promise.resolve()
    .then(() => ensureOcrCredentialsForSubmit({
      workflow,
      desktopMode,
      workflowNeedsCredentials,
      ensureOcrCredentialsReady,
      // 任务已经提交了，这时再把凭据弹窗怼到用户脸上只会打断他；
      // 失败原因由 setText shim 经 notify 报出，用户自己决定什么时候去改。
      openBrowserCredentialsDialog: undefined,
      setText: captureText,
    }))
    .catch(() => false);

  return Promise.all([budget, credentials]).then(() => undefined);
}
