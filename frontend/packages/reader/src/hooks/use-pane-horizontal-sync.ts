// 对照时两栏横向滚动同步：滚一栏（拖底部滚动条、触控板左右滑、Shift + 滚轮），另一栏跟着挪到同样的位置。
// 按「滚到可滚距离的几成」对齐，不按像素：原文和译文的页宽可能差一点，可滚距离不一样。
//
// 防回弹：给另一栏赋值也会触发它的 scroll 事件，再同步回来就成了来回拉。赋值后读回，真的变了才记下
// 「这一下是我挪的」，它的下一次 scroll 事件跳过；没变（已经在那个位置、或被夹住）就不记，免得吞掉用户下一次滚动。

import { useEffect } from "react";
import { READER_PANE_ATTR, READER_PDF_PANE_CLASS } from "../pdf/reader-dom-contract.js";

type HorizontalScroll = { scrollLeft: number; scrollWidth: number; clientWidth: number };

/** 按源栏滚到的比例，目标栏该滚到哪。源栏不能横滚时返回 null（不动目标栏）。 */
export function syncedScrollLeft(source: HorizontalScroll, target: HorizontalScroll): number | null {
  const sourceMax = source.scrollWidth - source.clientWidth;
  const targetMax = target.scrollWidth - target.clientWidth;
  if (sourceMax <= 1) return null;
  if (targetMax <= 1) return 0;
  const ratio = Math.min(1, Math.max(0, source.scrollLeft / sourceMax));
  return ratio * targetMax;
}

function isPdfPane(node: EventTarget | null): node is HTMLElement {
  return Boolean(
    node
    && (node as HTMLElement).classList?.contains(READER_PDF_PANE_CLASS)
    && (node as HTMLElement).hasAttribute?.(READER_PANE_ATTR),
  );
}

export function usePaneHorizontalSync(shellEl: HTMLElement | null, enabled: boolean): void {
  useEffect(() => {
    if (!shellEl || !enabled) return undefined;
    const moved = new WeakSet<HTMLElement>();
    const onScroll = (event: Event) => {
      const source = event.target;
      if (!isPdfPane(source) || source.classList.contains("is-hidden")) return;
      if (moved.has(source)) {
        moved.delete(source);
        return;
      }
      const panes = Array.from(shellEl.querySelectorAll<HTMLElement>(`.${READER_PDF_PANE_CLASS}[${READER_PANE_ATTR}]`));
      for (const target of panes) {
        if (target === source || target.classList.contains("is-hidden")) continue;
        const next = syncedScrollLeft(source, target);
        if (next === null || Math.abs(target.scrollLeft - next) < 1) continue;
        const before = target.scrollLeft;
        target.scrollLeft = next;
        if (Math.abs(target.scrollLeft - before) >= 0.5) moved.add(target);
      }
    };
    // 栏的 scroll 事件不冒泡，在阅读区上用捕获阶段收。
    shellEl.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => shellEl.removeEventListener("scroll", onScroll, { capture: true });
  }, [shellEl, enabled]);
}
