import type { ReaderIssue } from "../contracts/session.js";
export declare function useReaderIssues(jobId: string): ReaderIssue[];
/**
 * 按 N / Shift+N 走到下一处 / 上一处：接着上一次跳到的那条走；还没跳过就从眼下这一页往后（往前）找。
 * 没有了绕回头。返回要跳的序号，没有问题是 -1。
 */
export declare function stepIssue(issues: readonly ReaderIssue[], last: number, currentPage: number, backward: boolean): number;
//# sourceMappingURL=use-reader-issues.d.ts.map