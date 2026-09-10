// 在 PDF 文本层上监听正文选区；公式/表格/图片由独立结构选择层处理。

import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";
import type { ReaderTextSelection } from "../shared/data/reader-regions.js";
export type { ReaderTextSelection } from "../shared/data/reader-regions.js";

export function useReaderTextSelection(
  rootRef: RefObject<HTMLElement | null>,
  enabled = true,
): {
  selection: ReaderTextSelection | null;
  clearSelection: () => void;
} {
  const [selection, setSelection] = useState<ReaderTextSelection | null>(null);

  const clearSelection = useCallback(() => {
    setSelection(null);
    const sel = globalThis.getSelection?.();
    sel?.removeAllRanges?.();
  }, []);

  // rootRef.current may be stale; derive shellEl for correct scroll subscription
  const shellEl = (rootRef as RefObject<HTMLElement | null>).current ?? null;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const readSelection = () => {
      const root = rootRef.current;
      const sel = globalThis.getSelection?.();
      if (!root || !sel || sel.isCollapsed || !sel.rangeCount) {
        setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) {
        setSelection(null);
        return;
      }
      const quote = `${sel.toString() || ""}`.replace(/\s+/g, " ").trim();
      if (quote.length < 2) {
        setSelection(null);
        return;
      }

      // 找最近的页节点
      let node: Node | null = range.commonAncestorContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement;
      }
      const pageEl = (node as HTMLElement | null)?.closest?.(
        "[data-reader-page]",
      ) as HTMLElement | null;
      if (!pageEl || !root.contains(pageEl)) {
        setSelection(null);
        return;
      }
      const page = Math.max(1, Math.floor(Number(pageEl.getAttribute("data-reader-page")) || 1));
      const paneAttr = pageEl.getAttribute("data-reader-pane");
      const pane = paneAttr === "translated" ? "translated" : "source";

      const rects = range.getClientRects();
      const last = rects[rects.length - 1] || range.getBoundingClientRect();
      if (!last || (last.width === 0 && last.height === 0)) {
        setSelection(null);
        return;
      }

      // viewport clamp for toolbar: keep rect within visible viewport with padding
      const vw = typeof window !== "undefined" ? window.innerWidth : 800;
      const vh = typeof window !== "undefined" ? window.innerHeight : 600;
      const pad = 16;
      const clampedLeft = Math.min(Math.max(pad, last.left), vw - pad);
      const clampedTop = Math.min(Math.max(pad, last.top), vh - pad);

      setSelection({
        selectionType: "text",
        quote,
        page,
        pane,
        rect: {
          left: clampedLeft,
          top: clampedTop,
          width: last.width,
          height: last.height,
        },
      });
    };

    const scheduleRead = () => {
      window.setTimeout(readSelection, 0);
    };
    const onMouseUp = () => {
      // 等浏览器完成选区
      scheduleRead();
    };
    const onPointerUp = () => scheduleRead();
    const onTouchEnd = () => scheduleRead();
    const onSelectionChange = () => {
      // selectionchange fires frequently; defer to next frame to avoid thrash
      // only act when enabled and selection is within root
      scheduleRead();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearSelection();
      }
    };
    const onScroll = () => {
      // 滚动后选区屏幕坐标失效，清浮条（保留浏览器选区）
      setSelection((prev) => (prev ? null : prev));
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("keyup", onKeyUp);
    const targetEl: HTMLElement | null = shellEl ?? rootRef.current;
    targetEl?.addEventListener("scroll", onScroll, { passive: true });
    // also listen window scroll as fallback for shellEl overflow
    window.addEventListener("scroll", onScroll, { passive: true, capture: true } as AddEventListenerOptions);

    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("keyup", onKeyUp);
      targetEl?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll, true as unknown as EventListenerOptions);
    };
  }, [enabled, shellEl, clearSelection]);

  return { selection, clearSelection };
}
