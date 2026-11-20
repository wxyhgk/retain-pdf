// 底栏「待处理」：这次任务里要人看一眼的段落（没翻成、质检挑出的问题），从宿主的 loadIssues 读。
// 读不到（宿主没给、旧任务没有这些数据、合并出来的虚拟任务）就是空，底栏不出这个按钮。

import { useEffect, useState } from "react";

import type { ReaderIssue } from "../contracts/session.js";
import { readerSessionDataPort } from "../external.js";

export function useReaderIssues(jobId: string): ReaderIssue[] {
  const [issues, setIssues] = useState<ReaderIssue[]>([]);
  useEffect(() => {
    setIssues((current) => (current.length ? [] : current));
    const id = `${jobId || ""}`.trim();
    let load: ((jobId: string) => Promise<ReaderIssue[]>) | undefined;
    try {
      load = readerSessionDataPort().loadIssues;
    } catch {
      load = undefined;
    }
    if (!id || !load) return undefined;
    let disposed = false;
    load(id)
      .then((next) => { if (!disposed) setIssues(Array.isArray(next) ? next : []); })
      .catch(() => {});
    return () => { disposed = true; };
  }, [jobId]);
  return issues;
}

/**
 * 按 N / Shift+N 走到下一处 / 上一处：接着上一次跳到的那条走；还没跳过就从眼下这一页往后（往前）找。
 * 没有了绕回头。返回要跳的序号，没有问题是 -1。
 */
export function stepIssue(issues: readonly ReaderIssue[], last: number, currentPage: number, backward: boolean): number {
  if (!issues.length) return -1;
  if (last >= 0 && last < issues.length) return (last + (backward ? -1 : 1) + issues.length) % issues.length;
  if (backward) {
    for (let i = issues.length - 1; i >= 0; i -= 1) if (issues[i].page <= currentPage) return i;
    return issues.length - 1;
  }
  const next = issues.findIndex((issue) => issue.page >= currentPage);
  return next >= 0 ? next : 0;
}
