// 书里的引用（「图 2.1」「式 (3.21)」）：悬停一会儿浮出预览，点了跳过去；Alt+← 回到跳之前读到的地方，Alt+→ 再跳回去。
// 引用在文字层里认（shared/content/reader-xrefs.ts 的 renderXrefText 包了 span），这里在书页外壳上统一接事件。

import { useCallback, useEffect, useRef, useState } from "react";

import { applyPageScrollProgress, measurePageScrollProgress, type PageScrollProgress } from "../pdf/scroll-to-page.js";
import type { ReaderPaneId } from "../pdf/reader-dom-contract.js";
import { READER_XREF_ATTR, READER_XREF_CLASS, type XrefIndex, type XrefTarget } from "../shared/content/reader-xrefs.js";

export const XREF_PREVIEW_DELAY_MS = 250;
const HISTORY_LIMIT = 50;

export type XrefPreview = {
  target: XrefTarget;
  pane: ReaderPaneId;
  /** 引用那几个字在屏幕上的位置（预览挂在它旁边）。 */
  anchor: { left: number; top: number; right: number; bottom: number };
};

/** 前进后退的两个栈（纯函数，便于测试）：跳之前把当前位置压进「后退」，清空「前进」。 */
export type XrefHistory = { back: PageScrollProgress[]; forward: PageScrollProgress[] };

export function pushXrefHistory(history: XrefHistory, here: PageScrollProgress): XrefHistory {
  return { back: [...history.back, here].slice(-HISTORY_LIMIT), forward: [] };
}

/** 后退 / 前进一步：返回要去的位置和新的栈；那一边是空的返回 null。 */
export function stepXrefHistory(history: XrefHistory, here: PageScrollProgress, direction: "back" | "forward") {
  const from = direction === "back" ? history.back : history.forward;
  if (!from.length) return null;
  const to = from[from.length - 1];
  const rest = from.slice(0, -1);
  const next: XrefHistory = direction === "back"
    ? { back: rest, forward: [...history.forward, here] }
    : { back: [...history.back, here], forward: rest };
  return { to, history: next };
}

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(element?.closest?.("input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}

export function useReaderXrefs({
  shellEl,
  index,
  primaryPane,
  follow,
}: {
  shellEl: HTMLElement | null;
  index: XrefIndex;
  primaryPane: ReaderPaneId;
  /** 跳到这一块（阅读页的 jumpToAnchor）。 */
  follow: (target: XrefTarget, pane: ReaderPaneId) => void;
}) {
  const [preview, setPreview] = useState<XrefPreview | null>(null);
  const [history, setHistory] = useState<XrefHistory>({ back: [], forward: [] });
  const historyRef = useRef(history);
  historyRef.current = history;
  const timer = useRef<number | null>(null);
  const live = useRef({ index, primaryPane, follow, shellEl });
  live.current = { index, primaryPane, follow, shellEl };

  const here = useCallback((): PageScrollProgress | null => {
    const { shellEl: shell, primaryPane: pane } = live.current;
    return measurePageScrollProgress(shell, pane);
  }, []);

  useEffect(() => {
    if (!shellEl) return undefined;
    const xrefOf = (event: Event) => (event.target as Element | null)?.closest?.(`.${READER_XREF_CLASS}`) as HTMLElement | null;
    const clearTimer = () => {
      if (timer.current != null) window.clearTimeout(timer.current);
      timer.current = null;
    };
    const onOver = (event: PointerEvent) => {
      const element = xrefOf(event);
      if (!element) return;
      const target = live.current.index.get(element.getAttribute(READER_XREF_ATTR) || "");
      if (!target) return;
      const pane = (element.closest("[data-reader-pane]")?.getAttribute("data-reader-pane") || live.current.primaryPane) as ReaderPaneId;
      clearTimer();
      timer.current = window.setTimeout(() => {
        const rect = element.getBoundingClientRect();
        setPreview({ target, pane, anchor: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } });
      }, XREF_PREVIEW_DELAY_MS);
    };
    const onOut = (event: PointerEvent) => {
      const element = xrefOf(event);
      if (!element || element.contains(event.relatedTarget as Node | null)) return;
      clearTimer();
      setPreview(null);
    };
    const onClick = (event: MouseEvent) => {
      const element = xrefOf(event);
      if (!element || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      // 拖着选字时松手也会来 click：选了字就不跳。
      if (`${window.getSelection?.() || ""}`.trim()) return;
      const target = live.current.index.get(element.getAttribute(READER_XREF_ATTR) || "");
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      clearTimer();
      setPreview(null);
      const pane = (element.closest("[data-reader-pane]")?.getAttribute("data-reader-pane") || live.current.primaryPane) as ReaderPaneId;
      const position = here();
      if (position) setHistory((current) => pushXrefHistory(current, position));
      live.current.follow(target, pane);
    };
    const onScroll = () => {
      clearTimer();
      setPreview(null);
    };
    shellEl.addEventListener("pointerover", onOver);
    shellEl.addEventListener("pointerout", onOut);
    shellEl.addEventListener("click", onClick, true);
    shellEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimer();
      shellEl.removeEventListener("pointerover", onOver);
      shellEl.removeEventListener("pointerout", onOut);
      shellEl.removeEventListener("click", onClick, true);
      shellEl.removeEventListener("scroll", onScroll);
    };
  }, [shellEl, here]);

  const step = useCallback((direction: "back" | "forward"): boolean => {
    const position = here();
    if (!position) return false;
    const result = stepXrefHistory(historyRef.current, position, direction);
    if (!result) return false;
    const { shellEl: shell, primaryPane: pane } = live.current;
    if (!applyPageScrollProgress(shell, result.to, "auto", pane)) return false;
    setHistory(result.history);
    return true;
  }, [here]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey || event.defaultPrevented) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (isTyping(event.target)) return;
      const moved = step(event.key === "ArrowLeft" ? "back" : "forward");
      // 只有真的走了才拦下（不然浏览器的 Alt+← 后退照旧）。
      if (moved) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  return {
    preview,
    closePreview: useCallback(() => setPreview(null), []),
    canGoBack: history.back.length > 0,
    backPage: history.back.length ? history.back[history.back.length - 1].page : null,
    goBack: useCallback(() => step("back"), [step]),
  };
}
