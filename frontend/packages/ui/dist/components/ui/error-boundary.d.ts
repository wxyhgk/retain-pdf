import { Component, type ErrorInfo, type ReactNode } from "react";
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
/** 复制给我们排查用的文本：纯文本（贴进聊天框不糊），不带 Key 和本机路径以外的东西——页面地址只取路径和查询串。 */
export declare function errorDiagnosticText({ error, componentStack, label, now, location, userAgent, }: {
    error: unknown;
    componentStack?: string;
    label?: string;
    now?: Date;
    location?: Pick<Location, "pathname" | "search">;
    userAgent?: string;
}): string;
export declare class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState;
    static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState>;
    componentDidCatch(error: unknown, info: ErrorInfo): void;
    componentDidUpdate(previous: ErrorBoundaryProps): void;
    reset: () => void;
    render(): string | number | bigint | boolean | import("react").JSX.Element | Iterable<ReactNode> | Promise<string | number | bigint | boolean | Iterable<ReactNode> | import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>> | import("react").ReactPortal>;
}
export {};
//# sourceMappingURL=error-boundary.d.ts.map