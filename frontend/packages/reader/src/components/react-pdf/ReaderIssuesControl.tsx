// 底栏「待处理 N」：点开按类分组列出要人看一眼的段落（没翻成、内容问题、版面放不下），点一条跳到那一段；
// 按 N 走到下一处、Shift+N 回上一处（光标在输入框里时不接）。跳过去以后悬停那一段就能「改」。
import { useEffect, useRef, useState, type ReactElement } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@retainpdf/ui";

import type { ReaderIssue, ReaderIssueKind } from "../../contracts/session.js";
import { stepIssue, useReaderIssues } from "../../hooks/use-reader-issues.js";
import { useReaderContext } from "./reader-context.js";

const KIND_TITLES: Record<ReaderIssueKind, string> = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下",
};
const KIND_ORDER: ReaderIssueKind[] = ["failed", "content", "layout"];

function isTyping(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function ReaderIssuesControl({ jobId, currentPage }: { jobId: string; currentPage: number }): ReactElement | null {
  const issues = useReaderIssues(jobId);
  const jump = useReaderContext()?.jumpToBlock;
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState(-1);
  const root = useRef<HTMLDivElement | null>(null);
  useEffect(() => setLast(-1), [issues]);

  const goTo = (index: number) => {
    const issue = issues[index];
    if (!issue || !jump) return;
    setLast(index);
    jump(issue.readerItemId);
  };

  // N / Shift+N：在问题之间走。
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

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer, true);
    return () => document.removeEventListener("pointerdown", onPointer, true);
  }, [open]);

  if (!issues.length) return null;
  return (
    <div className="reader-react-hud-group reader-issues" ref={root} aria-label="待处理">
      <Button
        className="reader-react-hud-btn reader-issues-toggle"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`待处理 ${issues.length} 处`}
        title="这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）"
        onClick={() => setOpen((value) => !value)}
      >
        <TriangleAlert size={14} strokeWidth={2} aria-hidden="true" />
        <span>{issues.length}</span>
      </Button>
      {open ? (
        <div className="reader-issues-popover" role="dialog" aria-label="待处理">
          <p className="reader-issues-hint">点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。</p>
          {KIND_ORDER.map((kind) => {
            const group = issues.map((issue, index) => ({ issue, index })).filter(({ issue }) => issue.kind === kind);
            if (!group.length) return null;
            return (
              <section key={kind} className="reader-issues-group" data-issue-kind={kind}>
                <h4>{KIND_TITLES[kind]}<span>{group.length}</span></h4>
                <ol>
                  {group.map(({ issue, index }: { issue: ReaderIssue; index: number }) => (
                    <li key={`${issue.kind}:${issue.readerItemId}`}>
                      <Button
                        className="reader-issues-item"
                        aria-current={index === last ? "true" : undefined}
                        onClick={() => {
                          goTo(index);
                          setOpen(false);
                        }}
                      >
                        <span className="reader-issues-title">{issue.title}</span>
                        <span className="reader-issues-page">第 {issue.page} 页</span>
                        {issue.detail ? <span className="reader-issues-detail">{issue.detail}</span> : null}
                      </Button>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
