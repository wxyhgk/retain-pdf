// React 根的出错回调（createRoot 的 onCaughtError / onUncaughtError）：照 React 默认那样打到控制台，
// 在桌面端再把「哪个组件出的错」（组件栈）写进桌面日志 desktop-main.log。
//
// 为什么要：被出错兜底（ErrorBoundary）接住的错误不会触发 window 的 error 事件，preload 那条
// [desktop][renderer-issue] 日志根本记不到；生产包又压缩过，用户只能看到「React error #185」一个数字，
// 不知道是哪个组件。打包时保留了组件名（build-js-bundle.mjs 的 keepNames），这里把组件栈带上，
// 下次出事看日志就能定位。只在桌面壳提供 reportRendererIssue 时上报（旧版桌面壳、网页版只打控制台）。

import type { ErrorInfo } from "react";

const MAX_STACK = 4000;

type RendererIssuePayload = {
  type: string;
  message: string;
  stack?: string;
  componentStack?: string;
};

type RendererIssueBridge = {
  reportRendererIssue?: (payload: RendererIssuePayload) => void;
};

function clip(text: string): string {
  const value = `${text || ""}`.trim();
  return value.length > MAX_STACK ? `${value.slice(0, MAX_STACK)}…` : value;
}

export function rendererIssuePayload(
  type: string,
  error: unknown,
  componentStack = "",
): RendererIssuePayload {
  const message = error instanceof Error
    ? `${error.name || "Error"}: ${error.message}`
    : String(error);
  return {
    type,
    message: clip(message),
    stack: error instanceof Error ? clip(error.stack || "") : "",
    componentStack: clip(componentStack),
  };
}

export function reportRendererIssue(
  type: string,
  error: unknown,
  componentStack = "",
  bridge: RendererIssueBridge | undefined = (globalThis as { retainPdfDesktop?: RendererIssueBridge }).retainPdfDesktop,
): void {
  try {
    bridge?.reportRendererIssue?.(rendererIssuePayload(type, error, componentStack));
  } catch {
    // 上报自己出错不能再添乱。
  }
}

/** 传给 createRoot(host, options) 的出错回调。 */
export function reactRootErrorOptions() {
  return {
    // 被 ErrorBoundary 接住的（页面换成「出错了」说明卡）。
    onCaughtError(error: unknown, info: ErrorInfo) {
      console.error(error);
      reportRendererIssue("react-caught", error, info?.componentStack || "");
    },
    // 没被接住、整棵树卸掉的。React 默认用 reportError 抛给 window，照旧这么做。
    onUncaughtError(error: unknown, info: ErrorInfo) {
      reportRendererIssue("react-uncaught", error, info?.componentStack || "");
      if (typeof globalThis.reportError === "function") {
        globalThis.reportError(error);
      } else {
        console.error(error);
      }
    },
  };
}
