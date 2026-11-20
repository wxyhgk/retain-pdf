// 底栏（页码、书签、缩放）读书时让开：它浮在页面下方正中，正好压住正文最后一两行。
// 往下翻书（滚动的是放着书页的那一栏）时收起；往回翻、鼠标移到窗口底部、键盘焦点在底栏里、书签列表开着时出来。
// 侧栏（目录、搜索结果）里滚动不算翻书；程序自己滚的（打开时跳到上次读到的页、点目录跳页）也不算，
// 只认用户刚动过滚轮、触屏、键盘之后的滚动。整站「减弱动态效果」时只是没有过渡，收起照旧。

import { useEffect, useRef, useState, type RefObject } from "react";

import { READER_PAGE_ATTR } from "../../pdf/reader-dom-contract.js";

/** 连续往下翻多少像素才收起（一点点滚动不晃）。 */
const HIDE_AFTER_PX = 48;
/** 鼠标离窗口底多近时出来。 */
const REVEAL_ZONE_PX = 96;
/** 用户动过滚轮 / 触屏 / 键盘之后多久内的滚动算用户在翻书。 */
const USER_SCROLL_WINDOW_MS = 700;

/** 纯判断，方便测：这次滚动后底栏该不该藏。 */
export function nextHudHidden(hidden: boolean, downSoFar: number, delta: number): { hidden: boolean; downSoFar: number } {
  if (delta < -4) return { hidden: false, downSoFar: 0 };
  if (delta <= 0) return { hidden, downSoFar };
  const down = downSoFar + delta;
  return { hidden: hidden || down >= HIDE_AFTER_PX, downSoFar: down };
}

export function useHudAutoHide(rootRef: RefObject<HTMLElement | null>): boolean {
  const [hidden, setHidden] = useState(false);
  const downRef = useRef(0);
  useEffect(() => {
    const lastTop = new WeakMap<EventTarget, number>();
    let userInputAt = 0;
    const onUserInput = () => {
      userInputAt = Date.now();
    };
    const isPageScroller = new WeakMap<EventTarget, boolean>();
    const pinned = () => {
      const root = rootRef.current;
      // 用键盘走到底栏里（:focus-visible）、或书签列表开着时不收；鼠标点过按钮留下的焦点不算。
      return Boolean(root && (root.querySelector(":focus-visible") || root.querySelector("[aria-expanded='true']")));
    };
    const onScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!isPageScroller.has(target)) isPageScroller.set(target, Boolean(target.querySelector(`[${READER_PAGE_ATTR}]`)));
      if (!isPageScroller.get(target)) return;
      const top = target.scrollTop;
      const previous = lastTop.get(target);
      lastTop.set(target, top);
      if (previous === undefined || Date.now() - userInputAt > USER_SCROLL_WINDOW_MS) return;
      const next = nextHudHidden(false, downRef.current, top - previous);
      downRef.current = next.downSoFar;
      if (top - previous < -4) setHidden(false);
      else if (next.hidden && !pinned()) setHidden(true);
    };
    const onPointer = (event: PointerEvent) => {
      if (event.clientY >= window.innerHeight - REVEAL_ZONE_PX) {
        downRef.current = 0;
        setHidden(false);
      }
    };
    const onFocus = () => {
      if (pinned()) setHidden(false);
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("focusin", onFocus);
    for (const type of ["wheel", "touchmove", "keydown"] as const) window.addEventListener(type, onUserInput, { passive: true, capture: true });
    return () => {
      for (const type of ["wheel", "touchmove", "keydown"] as const) window.removeEventListener(type, onUserInput, { capture: true });
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("focusin", onFocus);
    };
  }, [rootRef]);
  return hidden;
}
