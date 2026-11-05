// 页宽基准一变（阅读区被挤窄、放宽，开关分栏），停在原来那一页。
//
// 以前页宽跟着阅读区变、页高跟着变，scrollTop 不变，眼前就换成了别的页（Studio 里书标签从 666px 收到
// 476px，第 41 页跳到第 53 页）。现在变之前在阅读线上记下「第几页、这页的几成」，重排之后放回阅读线上，
// 和 HUD 的当前页、切模式时恢复位置用同一套（pdf/scroll-to-page.ts）。不按比例缩 scrollTop
// （preserveScrollCenter 那样）：页与页之间的空隙不跟着缩，几十页累下来差出一屏。
//
// 页宽要等布局稳了才提交（PdfDocumentPane 的 80ms 防抖），再重画，内容高度实测要 600ms 左右才变，
// 所以不是改一次就完：之后每一帧都把记下的那一处放回阅读线上，等内容总高（比这一轮开始放回时）变过、又连着几帧不变才停，
// 最多 KEEP_MAX_MS（宽度变了页宽却没变，高度就一直不变）。
// 这期间用户自己滚（滚轮、触摸、按键、拖滚动条）就停手，听用户的。
//
// 光靠每帧放回不够：页宽提交之后，对照的行高同步、页的长宽比这些是在两帧之间改的，浏览器会先按旧的 scrollTop
// 画一帧——页一下子变矮，眼前成了几十页之后还没画过的页（整屏白），下一帧才回来。所以钉着的时候还看着内容的
// 尺寸（ResizeObserver 在排版之后、画之前回调），一变就当场放回去，那一帧画出来的就已经是原来那页。
// 只看高度：拖的时候宽度每帧都变，高度要等页宽提交才变。
//
// 停手要快：位置连着几帧不动、总高也变过（或者放回去以后过了 QUIET_MS 一直没变）就停。以前总高不变就一直跑满
// KEEP_MAX_MS，每帧量一遍、写一遍 scrollTop，WebKit 里每次换宽度（拖分隔线、开面板）主线程满两秒。
//
// 钉着的时候（也就是宽度在变的时候）壳上挂 RESIZING_CLASS：页画布这时才单独成层（react-pdf.css），拖的时候
// 浏览器搬层、不重画像素；平时不成层，免得几千个盖在画布上的文字块都要和它做重叠判断。

import { useEffect, useLayoutEffect, useRef } from "react";

import { READER_PAGE_ATTR, READER_PANE_ATTR, type ReaderPaneId } from "../pdf/reader-dom-contract.js";
import { READER_WIDTH_SETTLE_MS } from "../pdf/reader-zoom.js";
import { applyPageScrollProgress, measurePageScrollProgress, type PageScrollProgress } from "../pdf/scroll-to-page.js";

const KEEP_MAX_MS = 2000;
const STABLE_FRAMES = 6;
const QUIET_MS = 500;
const READER_RESIZING_CLASS = "reader-react-resizing";

type Hold = {
  pane: ReaderPaneId | null;
  progress: PageScrollProgress;
  started: number;
  stop: () => void;
};

export function useKeepPageOnResize(shell: HTMLElement | null, pageWidthBasis: number | null): void {
  const previous = useRef<number | null>(null);
  const hold = useRef<Hold | null>(null);

  // 布局阶段、页宽还没提交之前记下位置：这时眼前还是原来那一页。
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = pageWidthBasis;
    // 第一次量到宽度（null → 数）不是「变了」：那时还在找初始的页（URL 里的锚点）。
    if (!shell || before === null || pageWidthBasis === null || Math.abs(before - pageWidthBasis) < 1) return;
    // 一次拖动、一次开关面板会连着来好几个宽度：还在钉着的话接着用最开始量的那一处，
    // 不重新量（这时眼前可能已经被挪过了）。
    const kept = hold.current;
    kept?.stop();
    let base = kept ? { pane: kept.pane, progress: kept.progress, started: kept.started } : null;
    if (!base) {
      // 对照以外另一栏是藏着的（高度 0），两栏都有同号的页：量哪栏、放回哪栏要一致，都用看得见的那栏。
      const pane = visiblePane(shell);
      const progress = measurePageScrollProgress(shell, pane);
      if (!progress) return;
      base = { pane, progress, started: performance.now() };
    }
    const { pane, progress, started } = base;

    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // 「变过」比的是这一轮开始放回时的总高，不是最早量的那次：一次拖动里页宽会提交好几回（中间停一下就提交），
    // 跟最早的比，第二回起一开始就算「变过」，对照的行高还没跟上（晚一两百毫秒才变矮）就停了手，停在十几页之后。
    let startHeight = shell.scrollHeight;
    let lastHeight = startHeight;
    let stableFrames = 0;
    let looping = started;
    const heights = new WeakMap<Element, number>();
    const resized = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries) => {
          let taller = false;
          for (const entry of entries) {
            const height = Math.round(entry.contentRect.height);
            if (heights.has(entry.target) && heights.get(entry.target) !== height) taller = true;
            heights.set(entry.target, height);
          }
          if (taller) applyPageScrollProgress(shell, progress, "auto", pane);
        });
    const stop = () => {
      if (timer) clearTimeout(timer);
      cancelAnimationFrame(frame);
      resized?.disconnect();
      shell.classList.remove(READER_RESIZING_CLASS);
      for (const type of USER_SCROLL_EVENTS) shell.removeEventListener(type, stop);
      if (hold.current?.stop === stop) hold.current = null;
    };
    const tick = () => {
      applyPageScrollProgress(shell, progress, "auto", pane);
      const height = shell.scrollHeight;
      stableFrames = height === lastHeight ? stableFrames + 1 : 0;
      lastHeight = height;
      const elapsed = performance.now() - looping;
      const settled = stableFrames >= STABLE_FRAMES && (height !== startHeight || elapsed > QUIET_MS);
      if (settled || elapsed > KEEP_MAX_MS) stop();
      else frame = requestAnimationFrame(tick);
    };
    for (const type of USER_SCROLL_EVENTS) shell.addEventListener(type, stop, { passive: true });
    for (const child of Array.from(shell.children)) resized?.observe(child);
    shell.classList.add(READER_RESIZING_CLASS);
    hold.current = { ...base, stop };
    // 宽度还在变（拖分栏、开关侧栏的过渡）时什么都不量：页宽要等停稳 READER_WIDTH_SETTLE_MS 才提交（PdfDocumentPane），
    // 在那之前眼前的页不会动；每帧去量反倒逼浏览器每帧把整本书排一遍（大书拖起来一顿一顿）。停稳了再开始放回去。
    timer = setTimeout(() => {
      timer = null;
      looping = performance.now();
      startHeight = shell.scrollHeight;
      lastHeight = startHeight;
      stableFrames = 0;
      frame = requestAnimationFrame(tick);
    }, READER_WIDTH_SETTLE_MS);
  }, [shell, pageWidthBasis]);

  useEffect(() => () => hold.current?.stop(), []);
}

/** 第一张看得见的页在哪一栏。 */
function visiblePane(shell: HTMLElement): ReaderPaneId | null {
  for (const element of Array.from(shell.querySelectorAll<HTMLElement>(`[${READER_PAGE_ATTR}]`))) {
    const rect = element.getBoundingClientRect();
    if (rect.height >= 8 && rect.width >= 8) return (element.getAttribute(READER_PANE_ATTR) as ReaderPaneId | null) || null;
  }
  return null;
}

const USER_SCROLL_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
