// 浮着的顶栏（返回、原文 / 对照 / 译文）什么时候露出来（2026-11-28 用户：「停留的时候，不应该显示顶部的三个按钮，我觉得这样心流更强」，
// 返回「要一起藏」）：
// - 鼠标移到书页区顶上 TOPBAR_REVEAL_ZONE_PX 以内才出来；只是在书页上动（悬停段落、选字）不出来，免得一闪一闪；
// - 离开那一条（或移出书页区）TOPBAR_HIDE_DELAY_MS 后淡掉；刚打开先露 TOPBAR_FIRST_SHOW_MS，让人知道它在哪；
// - 滚动书页时也出来（11-28 用户：「滚动的时候得出现这些按钮，不然用户可能看不到」），停下 TOPBAR_HIDE_DELAY_MS 后淡掉；
// - 换了模式（按 1 / 2 / 3）闪出来 TOPBAR_FLASH_MS，看得到切到了哪个。
// - 键盘 Tab 到上面（焦点是 :focus-visible 的）就出来，焦点在上面时不收；鼠标点过留在按钮上的焦点不算
//   （不放 CSS 的 :has(:focus-visible)：点过页签再按 1 / 2 / 3，浏览器会把那颗按钮改算成 :focus-visible，顶栏就一直挂着）。
// 别的不藏的几种（翻译进行中的进度、「对照」▾ 开着、触屏没有悬停）在 CSS 里按 :has / @media (hover) 判断（chrome.css）。
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export const TOPBAR_REVEAL_ZONE_PX = 72;
export const TOPBAR_HIDE_DELAY_MS = 1500;
export const TOPBAR_FIRST_SHOW_MS = 2000;
export const TOPBAR_FLASH_MS = 1200;

/** 鼠标离书页区顶多远算「到顶上了」。 */
export function isInRevealZone(pointerY: number, stageTop: number): boolean {
  return pointerY - stageTop < TOPBAR_REVEAL_ZONE_PX;
}

function isFocusVisible(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return false;
  }
}

/** 顶栏这时露不露。`bar` 是顶栏本身，它的父元素（书页区）上听鼠标。 */
export function useTopBarReveal(bar: RefObject<HTMLElement | null>, mode: string): boolean {
  const [shown, setShown] = useState(true);
  const timer = useRef<number | null>(null);
  const near = useRef(false);
  // 焦点是键盘带进来的：在焦点进来那一下记，不在收的时候现查 :focus-visible（点过页签再按键，浏览器会改算成 :focus-visible）。
  const keyboardFocus = useRef(false);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  const hideLater = useCallback((ms: number) => {
    clear();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if (!keyboardFocus.current) setShown(false);
    }, ms);
  }, [clear]);

  useEffect(() => {
    const stage = bar.current?.parentElement;
    if (!stage) return undefined;
    // 书页区的顶在布局变了才会动：进来时量一次、窗口改大小时再量，别每次 pointermove 都量（WebKit 量一次就整棵重排）。
    let stageTop = stage.getBoundingClientRect().top;
    const measure = () => { stageTop = stage.getBoundingClientRect().top; };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      if (isInRevealZone(event.clientY, stageTop)) {
        if (!near.current) {
          near.current = true;
          clear();
          setShown(true);
        }
      } else if (near.current) {
        near.current = false;
        hideLater(TOPBAR_HIDE_DELAY_MS);
      }
    };
    const onLeave = () => {
      if (!near.current) return;
      near.current = false;
      hideLater(TOPBAR_HIDE_DELAY_MS);
    };
    const onFocusIn = (event: FocusEvent) => {
      keyboardFocus.current = event.target instanceof Element && isFocusVisible(event.target);
      if (!keyboardFocus.current) return;
      clear();
      setShown(true);
    };
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (next instanceof Node && bar.current?.contains(next)) return;
      const wasKeyboard = keyboardFocus.current;
      keyboardFocus.current = false;
      if (wasKeyboard && !near.current) hideLater(TOPBAR_HIDE_DELAY_MS);
    };
    // 滚书页（scroll 不冒泡，在书页区上用捕获听）：出来，停下一会儿再收；鼠标在顶上时本来就露着，不去收。
    const onScroll = () => {
      if (near.current) return;
      setShown(true);
      hideLater(TOPBAR_HIDE_DELAY_MS);
    };
    // 在上面按下鼠标：之后留着的焦点不算键盘的。
    const onPointerDown = () => { keyboardFocus.current = false; };
    const header = bar.current;
    hideLater(TOPBAR_FIRST_SHOW_MS);
    header?.addEventListener("focusin", onFocusIn);
    header?.addEventListener("focusout", onFocusOut);
    header?.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("scroll", onScroll, { capture: true, passive: true });
    stage.addEventListener("pointerenter", measure);
    stage.addEventListener("pointermove", onMove, { passive: true });
    stage.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", measure);
    return () => {
      clear();
      header?.removeEventListener("focusin", onFocusIn);
      header?.removeEventListener("focusout", onFocusOut);
      header?.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("scroll", onScroll, { capture: true });
      stage.removeEventListener("pointerenter", measure);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", measure);
    };
  }, [bar, clear, hideLater]);

  // 换了模式闪一下（第一次挂上不算；鼠标就在顶上时本来就露着，不去收）。
  const lastMode = useRef(mode);
  useEffect(() => {
    if (lastMode.current === mode) return;
    lastMode.current = mode;
    if (near.current) return;
    setShown(true);
    hideLater(TOPBAR_FLASH_MS);
  }, [mode, hideLater]);

  return shown;
}
