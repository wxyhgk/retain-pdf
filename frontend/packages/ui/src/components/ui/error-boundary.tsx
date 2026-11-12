// 出错兜底：一个组件渲染时抛错，React 会把整棵树卸掉，页面直接白屏，用户只能说「坏了」，开发拿不到调用栈。
// 套上它，出错的那一块换成一张说明卡：哪一块坏了、再试一次、重新加载、复制错误详情（给我们排查用）。
//
// 两种用法：
//   scope="page"     每个页面入口最外层套一层（web 的 mountShellPage、阅读页 bootReader）；
//   scope="section"  页面里坏一块不该拖垮整页的地方（书籍详情的每个页签）。
//
// 只接得住渲染、生命周期里的错误；事件回调、异步请求里的错误本来就不会白屏，各自的 catch 管。
// 样子在 styles/error-boundary.css（阅读页的样式单独打包，也引了这一份）。按钮不用 Button 的 variant：
// 阅读页没有引基础组件的样式，用自带的类名两边都一样。

import { Component, useState, type ErrorInfo, type ReactNode } from "react";

export type ErrorBoundaryProps = {
  children?: ReactNode;
  /** page：整页兜底；section：页面里的一块。 */
  scope?: "page" | "section";
  /** 出错时说是哪一块，例如「“进度”页」。不给就说「这一块」。 */
  label?: string;
  /** 这些值变了就自动退出出错状态（换了一本书之类）。 */
  resetKeys?: readonly unknown[];
  /** 接到错误时通知调用方（打日志）。React 自己也会把错误打到控制台。 */
  onError?: (error: unknown, info: ErrorInfo) => void;
};

type ErrorBoundaryState = {
  error: unknown;
  componentStack: string;
  /** 出错时的 resetKeys，用来判断后来变没变。 */
  keysAtError: readonly unknown[] | undefined;
};

const MAX_MESSAGE = 300;

function errorName(error: unknown): string {
  return error instanceof Error ? error.name || "Error" : typeof error;
}

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const text = `${raw || ""}`.trim() || "（没有错误信息）";
  return text.length > MAX_MESSAGE ? `${text.slice(0, MAX_MESSAGE)}…` : text;
}

/** 复制给我们排查用的文本：纯文本（贴进聊天框不糊），不带 Key 和本机路径以外的东西——页面地址只取路径和查询串。 */
export function errorDiagnosticText({
  error,
  componentStack = "",
  label = "",
  now = new Date(),
  location = typeof window === "undefined" ? undefined : window.location,
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent,
}: {
  error: unknown;
  componentStack?: string;
  label?: string;
  now?: Date;
  location?: Pick<Location, "pathname" | "search">;
  userAgent?: string;
}): string {
  const stack = error instanceof Error ? `${error.stack || ""}`.trim() : "";
  const lines = [
    `时间: ${now.toISOString()}`,
    label ? `位置: ${label}` : "",
    location ? `页面: ${location.pathname}${location.search}` : "",
    userAgent ? `浏览器: ${userAgent}` : "",
    `错误: ${errorName(error)}: ${error instanceof Error ? error.message : String(error)}`,
    stack ? `\n调用栈:\n${stack}` : "",
    componentStack.trim() ? `\n组件栈:${componentStack}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function sameKeys(a: readonly unknown[] | undefined, b: readonly unknown[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((value, index) => Object.is(value, b[index]));
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 剪贴板不让写（非安全上下文、没授权）：退回选中文本那一招。
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function ErrorFallback({
  error,
  componentStack,
  scope,
  label,
  onRetry,
}: {
  error: unknown;
  componentStack: string;
  scope: "page" | "section";
  label: string;
  onRetry: () => void;
}) {
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const where = label || (scope === "page" ? "页面" : "这一块");
  const copy = async () => {
    const ok = await copyText(errorDiagnosticText({ error, componentStack, label: where }));
    setCopied(ok ? "ok" : "fail");
    window.setTimeout(() => setCopied(""), 1800);
  };
  return (
    <div className="ui-error-fallback" data-scope={scope} role="alert">
      <p className="ui-error-fallback-title">{where}出错了</p>
      <p className="ui-error-fallback-text">
        {scope === "page"
          ? "可以先再试一次；还不行就重新加载页面。反复出现请点「复制错误详情」发给我们。"
          : "页面其他部分不受影响。可以先再试一次；还不行就重新加载页面。反复出现请点「复制错误详情」发给我们。"}
      </p>
      <p className="ui-error-fallback-message">{errorMessage(error)}</p>
      <div className="ui-error-fallback-actions">
        <button type="button" className="ui-error-fallback-action" data-primary="true" onClick={onRetry}>再试一次</button>
        <button type="button" className="ui-error-fallback-action" onClick={() => window.location.reload()}>重新加载页面</button>
        <button type="button" className="ui-error-fallback-action" onClick={() => void copy()}>
          {copied === "ok" ? "已复制" : copied === "fail" ? "复制失败" : "复制错误详情"}
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: "", keysAtError: undefined };

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    // throw undefined / null 也算出错：用一个占位对象，免得下面按「没出错」处理。
    return { error: error ?? new Error("（抛出了空值）") };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack || "", keysAtError: this.props.resetKeys });
    try {
      this.props.onError?.(error, info);
    } catch {
      // 上报自己出错不能再把兜底弄坏。
    }
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.error && previous.resetKeys !== this.props.resetKeys
      && !sameKeys(this.state.keysAtError, this.props.resetKeys)) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({ error: null, componentStack: "", keysAtError: undefined });
  };

  render() {
    if (!this.state.error) return this.props.children ?? null;
    return (
      <ErrorFallback
        error={this.state.error}
        componentStack={this.state.componentStack}
        scope={this.props.scope ?? "section"}
        label={this.props.label ?? ""}
        onRetry={this.reset}
      />
    );
  }
}
