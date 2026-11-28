import type { ReaderIssue, ReaderIssueKind } from "../contracts/session.js";
export declare function useReaderIssues(jobId: string): ReaderIssue[];
/**
 * 按 N / Shift+N 走到下一处 / 上一处：接着上一次跳到的那条走；还没跳过就从眼下这一页往后（往前）找。
 * 没有了绕回头。返回要跳的序号，没有问题是 -1。
 */
export declare function stepIssue(issues: readonly ReaderIssue[], last: number, currentPage: number, backward: boolean): number;
export declare const ISSUE_KIND_TITLES: Record<ReaderIssueKind, string>;
export declare const ISSUE_KIND_ORDER: readonly ReaderIssueKind[];
/** 待处理的段落、上一次跳到哪条、跳到第几条；按 N / Shift+N 在它们之间走（光标在输入框里时不接）。 */
export declare function useReaderIssueNav(jobId: string, currentPage: number, jump: ((itemId: string) => void) | undefined): {
    issues: ReaderIssue[];
    last: number;
    goTo: (index: number) => void;
};
export type ReaderIssueNav = ReturnType<typeof useReaderIssueNav>;
//# sourceMappingURL=use-reader-issues.d.ts.map