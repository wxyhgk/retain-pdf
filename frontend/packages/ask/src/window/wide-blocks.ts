// 回答里太宽的独立公式、表格（2026-11-27）：窄窗口（贴右边 440px）里多步推导常常横着滚。
// 宽得不多（1.5 倍以内）就缩到放得下（CSS zoom，字还看得清）；再宽就照旧横着滚，窗口里出一个「放大看」（交给 AskWindow 画）。
// 只改这些块自己的 style.zoom 和 data-wide，不往 Markdown 里插节点（那是 React 管的）。
import { useEffect, useState, type RefObject } from "react";

const WIDE_SELECTOR = ".katex-display, .aui-md-table-wrapper";
/** 最多缩到多少（再小字就看不清了，改成横着滚）。 */
export const MIN_FIT = 1 / 1.5;

/** 内容宽 / 能放的宽 → 怎么放：放得下、缩一点、横着滚（缩放比例）。 */
export function fitPlan(contentWidth: number, boxWidth: number): { mode: "fits" | "fit" | "scroll"; zoom: number } {
  if (boxWidth <= 0 || contentWidth <= boxWidth + 1) return { mode: "fits", zoom: 1 };
  const zoom = boxWidth / contentWidth;
  return zoom >= MIN_FIT ? { mode: "fit", zoom: Math.floor(zoom * 1000) / 1000 } : { mode: "scroll", zoom: 1 };
}

function contentWidth(block: HTMLElement): number {
  const inner = block.firstElementChild as HTMLElement | null;
  return Math.max(inner?.scrollWidth || 0, block.scrollWidth);
}

/** 扫一遍：每块先还原再量，返回还要横着滚的块数。 */
export function fitWideBlocks(root: HTMLElement): number {
  let scrolling = 0;
  for (const block of Array.from(root.querySelectorAll<HTMLElement>(WIDE_SELECTOR))) {
    block.style.removeProperty("zoom");
    const plan = fitPlan(contentWidth(block), block.clientWidth);
    if (plan.mode === "fit") block.style.setProperty("zoom", String(plan.zoom));
    if (plan.mode === "fits") block.removeAttribute("data-wide");
    else block.setAttribute("data-wide", plan.mode);
    if (plan.mode === "scroll") scrolling += 1;
  }
  return scrolling;
}

/** 盯着对话区：内容变了（流式写出来）、窗口宽窄变了，重新放一遍。返回还要横着滚的块数。 */
export function useWideBlocks(root: RefObject<HTMLElement | null>): number {
  const [scrolling, setScrolling] = useState(0);
  useEffect(() => {
    const element = root.current;
    if (!element || typeof MutationObserver === "undefined") return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setScrolling(fitWideBlocks(element)), 200);
    };
    // 只看节点和文字（不看属性：我们自己改 style、data-wide 不能再触发一遍）。
    const mutations = new MutationObserver(run);
    mutations.observe(element, { childList: true, subtree: true, characterData: true });
    const sizes = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(run);
    sizes?.observe(element);
    run();
    return () => {
      if (timer) clearTimeout(timer);
      mutations.disconnect();
      sizes?.disconnect();
    };
  }, [root]);
  return scrolling;
}
