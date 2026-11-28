// 「待处理」：这次任务里要人看一眼的段落（没翻成、质检挑出的问题），从宿主的 loadIssues 读。
// 读不到（宿主没给、旧任务没有这些数据、合并出来的虚拟任务）就是空，左栏不出这个页签。
// 2026-11-27 从底栏挪进左栏；N / Shift+N 照旧（useReaderIssueNav，左栏收着也能用）。

import { useCallback, useEffect, useRef, useState } from "react";

import type { ReaderIssue, ReaderIssueKind } from "../contracts/session.js";
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

export const ISSUE_KIND_TITLES: Record<ReaderIssueKind, string> = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下",
};
export const ISSUE_KIND_ORDER: readonly ReaderIssueKind[] = ["failed", "content", "layout"];

function isTyping(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

/** 待处理的段落、上一次跳到哪条、跳到第几条；按 N / Shift+N 在它们之间走（光标在输入框里时不接）。 */
export function useReaderIssueNav(jobId: string, currentPage: number, jump: ((itemId: string) => void) | undefined) {
  const issues = useReaderIssues(jobId);
  const [last, setLast] = useState(-1);
  useEffect(() => setLast(-1), [issues]);
  const goTo = useCallback((index: number) => {
    const issue = issues[index];
    if (!issue || !jump) return;
    setLast(index);
    jump(issue.readerItemId);
  }, [issues, jump]);
  const stateRef = useRef({ issues, last, currentPage, goTo });
  stateRef.current = { issues, last, currentPage, goTo };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const { issues: list, last: at, currentPage: page, goTo: go } = stateRef.current;
      const index = stepIssue(list, at, page, event.shiftKey);
      if (index < 0) return;
      event.preventDefault();
      go(index);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return { issues, last, goTo };
}

export type ReaderIssueNav = ReturnType<typeof useReaderIssueNav>;
