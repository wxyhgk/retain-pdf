// Ctrl + 滚轮 / 触控板捏合缩放阅读页。为什么手势中只做 CSS 预览、停手才真改缩放，见 pdf/reader-wheel-zoom.ts。
//
// 浏览器（和桌面端 Electron）默认会把 Ctrl + 滚轮当成整页缩放，连顶栏底栏一起放大；在阅读区里拦下来
// （非 passive 监听 + preventDefault），只缩放书页。阅读区外面照旧是浏览器自己的。

import { useEffect, useLayoutEffect, useRef } from "react";
import {
  WHEEL_ZOOM_SETTLE_MS,
  applyWheelPreview,
  captureZoomAnchor,
  clearWheelPreview,
  nextWheelZoom,
  restoreZoomAnchor,
  roundWheelZoom,
  wheelPreviewScale,
  type ReaderZoomAnchor,
} from "../pdf/reader-wheel-zoom.js";
import type { ReaderZoomChange } from "./use-reader-zoom.js";

type Gesture = {
  start: number;
  target: number;
  anchor: ReaderZoomAnchor | null;
  grid: HTMLElement | null;
  timer: ReturnType<typeof setTimeout> | null;
};

type PendingCommit = {
  anchor: ReaderZoomAnchor | null;
  grid: HTMLElement | null;
  fallback: ReturnType<typeof setTimeout> | null;
};

/** 提交后最多等这么久新缩放落地；万一没落地（比如被别的缩放抢先），也要把预览拿掉。 */
const COMMIT_FALLBACK_MS = 600;
/**
 * 提交后这段时间里页面区尺寸每变一次就把锚点再对一次：对照模式两栏的行高要等量完才更新（usePageRowSync
 * 在 100ms、700ms 各对一次），缩小时页要过一会儿才变矮，那时滚动位置已经被浏览器夹到底了（实测 300 页从
 * 100% 缩到 25% 跳到最后一页）。用户自己一滚、一按键、一点就停，不和用户抢滚动条。
 */
const ANCHOR_HOLD_MS = 1000;

/** 在 ANCHOR_HOLD_MS 内跟着布局变化重新对齐锚点；返回停止函数。 */
function holdZoomAnchor(shell: HTMLElement, anchor: ReaderZoomAnchor): () => void {
  const grid = shell.firstElementChild;
  const view = shell.ownerDocument.defaultView;
  if (!grid || !view || typeof view.ResizeObserver === "undefined") return () => {};
  let stopped = false;
  const observer = new view.ResizeObserver(() => {
    if (!stopped) restoreZoomAnchor(shell, anchor);
  });
  observer.observe(grid);
  const onUserInput = (event: Event) => {
    if (event.type === "wheel" && (event as WheelEvent).ctrlKey) return;
    stop();
  };
  const inputs = ["wheel", "keydown", "pointerdown", "touchstart"] as const;
  for (const type of inputs) view.addEventListener(type, onUserInput, { capture: true, passive: true });
  const timer = view.setTimeout(() => stop(), ANCHOR_HOLD_MS);
  function stop() {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    view?.clearTimeout(timer);
    for (const type of inputs) view?.removeEventListener(type, onUserInput, { capture: true });
  }
  return stop;
}

export function useReaderWheelZoom(
  shellEl: HTMLElement | null,
  userZoom: number,
  onZoomChange: ReaderZoomChange,
): void {
  const zoomRef = useRef(userZoom);
  zoomRef.current = userZoom;
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;
  const gestureRef = useRef<Gesture | null>(null);
  const pendingRef = useRef<PendingCommit | null>(null);
  const stopHoldRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!shellEl) return undefined;

    const commit = () => {
      const gesture = gestureRef.current;
      gestureRef.current = null;
      if (!gesture) return;
      const next = roundWheelZoom(gesture.target);
      if (Math.abs(next - zoomRef.current) < 0.005) {
        clearWheelPreview(gesture.grid);
        return;
      }
      const pending: PendingCommit = { anchor: gesture.anchor, grid: gesture.grid, fallback: null };
      pending.fallback = setTimeout(() => {
        if (pendingRef.current !== pending) return;
        pendingRef.current = null;
        clearWheelPreview(pending.grid);
      }, COMMIT_FALLBACK_MS);
      pendingRef.current = pending;
      // 滚动位置由下面的 layout effect 按鼠标锚点对，不要 useReaderZoom 再按视口中心拉一次。
      onZoomChangeRef.current(next, { keepScroll: false });
    };

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      let gesture = gestureRef.current;
      if (!gesture) {
        stopHoldRef.current?.();
        stopHoldRef.current = null;
        // 上一次提交还没落地就又开始捏：先把上一次的预览收掉，从现在的缩放重新算。
        const pending = pendingRef.current;
        if (pending) {
          if (pending.fallback) clearTimeout(pending.fallback);
          pendingRef.current = null;
          clearWheelPreview(pending.grid);
        }
        gesture = {
          start: zoomRef.current,
          target: zoomRef.current,
          anchor: captureZoomAnchor(shellEl, event.clientX, event.clientY),
          grid: null,
          timer: null,
        };
        gestureRef.current = gesture;
      }
      gesture.target = nextWheelZoom(gesture.target, event.deltaY, event.deltaMode);
      const scale = wheelPreviewScale(gesture.start, gesture.target, gesture.anchor?.pageWidth ?? 0);
      gesture.grid = applyWheelPreview(shellEl, scale, event.clientX, event.clientY) ?? gesture.grid;
      if (gesture.timer) clearTimeout(gesture.timer);
      gesture.timer = setTimeout(commit, WHEEL_ZOOM_SETTLE_MS);
    };

    shellEl.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      shellEl.removeEventListener("wheel", onWheel);
      const gesture = gestureRef.current;
      gestureRef.current = null;
      if (gesture?.timer) clearTimeout(gesture.timer);
      clearWheelPreview(gesture?.grid ?? null);
      stopHoldRef.current?.();
      stopHoldRef.current = null;
    };
  }, [shellEl]);

  // 新缩放提交到 DOM 后、浏览器画出来之前：拿掉预览，把鼠标下那一点对回去；之后布局还会变（见 ANCHOR_HOLD_MS），跟着再对。
  useLayoutEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    if (pending.fallback) clearTimeout(pending.fallback);
    clearWheelPreview(pending.grid);
    if (!shellEl || !pending.anchor) return;
    restoreZoomAnchor(shellEl, pending.anchor);
    stopHoldRef.current?.();
    stopHoldRef.current = holdZoomAnchor(shellEl, pending.anchor);
  }, [userZoom, shellEl]);
}
