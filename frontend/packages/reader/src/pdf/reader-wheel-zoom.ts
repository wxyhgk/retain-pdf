// Ctrl + 滚轮（Mac 触控板双指捏合也是这个事件）缩放阅读页。
//
// 大 PDF 的性能：滚轮一格就是好几个事件，触控板捏一下有几十个。每个事件都真改缩放的话，每次都要重排所有页的
// 高度、重画眼前几页的画布（重画还会取消上一次没画完的）。所以手势进行中只给整个页面区加 CSS transform
// 预览（GPU 合成，不重排、不重画），停手 WHEEL_ZOOM_SETTLE_MS 后才真改一次缩放；重画期间每页先用上一张画布
// 按新尺寸顶着（PdfPageSlot 的 keepLastPaint），画布只挂在视口附近的页上（PdfDocumentPane 的窗口化）。
// 缩放上限照旧是 READER_ZOOM_MAX（页宽 = 整个阅读区），不会画出比现在更大的画布。
//
// 缩放以鼠标所在的点为中心：手势开始时记下鼠标落在哪一页的哪个位置（按页内比例，不按滚动距离——页与页之间
// 的间距不随缩放变，按比例算滚动距离，越往后偏得越多），改完缩放把那一点滚回鼠标下面。

import { READER_PANE_FIT_INSET, clampReaderZoom, fitContentWidth } from "./reader-zoom.js";
import {
  READER_GRID_CLASS,
  READER_PAGE_ATTR,
  READER_PANE_ATTR,
  pageSlotSelector,
} from "./reader-dom-contract.js";

/** 停手多久算一次缩放结束。 */
export const WHEEL_ZOOM_SETTLE_MS = 160;
/** 每像素滚动量对应的缩放指数；滚轮一格（约 100px，截到 WHEEL_ZOOM_MAX_STEP_PX）约 ±14%。 */
const WHEEL_ZOOM_SENSITIVITY = 0.003;
const WHEEL_ZOOM_MAX_STEP_PX = 50;
const LINE_HEIGHT_PX = 16;
const PAGE_HEIGHT_PX = 800;

/** 一个滚轮事件对应的缩放倍数（> 1 放大）。往上滚（deltaY < 0）放大，和浏览器一致。 */
export function wheelZoomFactor(deltaY: number, deltaMode = 0): number {
  const unit = deltaMode === 1 ? LINE_HEIGHT_PX : deltaMode === 2 ? PAGE_HEIGHT_PX : 1;
  const px = Number(deltaY) * unit;
  if (!Number.isFinite(px) || px === 0) return 1;
  const clamped = Math.max(-WHEEL_ZOOM_MAX_STEP_PX, Math.min(WHEEL_ZOOM_MAX_STEP_PX, px));
  return Math.exp(-clamped * WHEEL_ZOOM_SENSITIVITY);
}

/** 手势累积到的目标缩放（夹在上下限里）。 */
export function nextWheelZoom(current: number, deltaY: number, deltaMode = 0): number {
  return clampReaderZoom(current * wheelZoomFactor(deltaY, deltaMode));
}

/** 提交的缩放取两位小数，和 +/- 按钮、百分比显示一致。 */
export function roundWheelZoom(zoom: number): number {
  return Math.round(clampReaderZoom(zoom) * 100) / 100;
}

/**
 * 预览用的 CSS 缩放倍数：新页宽 / 现在的页宽。页宽不和缩放成正比（扣了固定的内边距，见 fitContentWidth），
 * 直接用 target / start 的话，松手那一下会跳几个像素。
 */
export function wheelPreviewScale(startZoom: number, targetZoom: number, pageWidth: number): number {
  const start = clampReaderZoom(startZoom);
  const width = Number(pageWidth);
  if (!Number.isFinite(width) || width <= 0) return clampReaderZoom(targetZoom) / start;
  const basis = (width + READER_PANE_FIT_INSET) / start;
  return fitContentWidth(basis * clampReaderZoom(targetZoom)) / width;
}

export type ReaderZoomAnchor = {
  page: string;
  pane: string;
  /** 鼠标在这一页里的位置，按页宽、页高的比例。 */
  fracX: number;
  fracY: number;
  clientX: number;
  clientY: number;
  /** 手势开始时这一页的宽（算预览倍数用）。 */
  pageWidth: number;
};

function pageSlots(shell: HTMLElement): HTMLElement[] {
  return Array.from(shell.querySelectorAll<HTMLElement>(pageSlotSelector()));
}

function distanceToRect(rect: DOMRect, x: number, y: number): number {
  const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
  const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
  return Math.hypot(dx, dy);
}

/** 记下鼠标落在哪一页的哪个位置；鼠标在页与页的空隙里时取最近的一页。没有页时返回 null。 */
export function captureZoomAnchor(shell: HTMLElement, clientX: number, clientY: number): ReaderZoomAnchor | null {
  let best: { el: HTMLElement; rect: DOMRect; distance: number } | null = null;
  for (const el of pageSlots(shell)) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const distance = distanceToRect(rect, clientX, clientY);
    if (!best || distance < best.distance) best = { el, rect, distance };
    if (distance === 0) break;
  }
  if (!best) return null;
  const { el, rect } = best;
  return {
    page: el.getAttribute(READER_PAGE_ATTR) || "",
    pane: el.getAttribute(READER_PANE_ATTR) || "",
    fracX: (clientX - rect.left) / rect.width,
    fracY: (clientY - rect.top) / rect.height,
    clientX,
    clientY,
    pageWidth: rect.width,
  };
}

function horizontalScroller(el: HTMLElement, shell: HTMLElement): HTMLElement {
  for (let node = el.parentElement; node && node !== shell; node = node.parentElement) {
    if (node.scrollWidth > node.clientWidth + 1) return node;
  }
  return shell;
}

/** 改完缩放后，把记下的那一点滚回鼠标下面。可以重复调（布局还在变时再对一次），结果不变。 */
export function restoreZoomAnchor(shell: HTMLElement, anchor: ReaderZoomAnchor | null): void {
  if (!anchor) return;
  const el = shell.querySelector<HTMLElement>(
    `${pageSlotSelector()}[${READER_PAGE_ATTR}="${anchor.page}"][${READER_PANE_ATTR}="${anchor.pane}"]`,
  );
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const dy = rect.top + anchor.fracY * rect.height - anchor.clientY;
  const dx = rect.left + anchor.fracX * rect.width - anchor.clientX;
  if (Math.abs(dy) >= 0.5) shell.scrollTop += dy;
  if (Math.abs(dx) >= 0.5) {
    // 对照时另一栏由 usePaneHorizontalSync 跟着这一栏挪，这里只管鼠标所在的那一栏。
    horizontalScroller(el, shell).scrollLeft += dx;
  }
}

/** 预览：整个页面区按鼠标所在点缩放。 */
export function applyWheelPreview(shell: HTMLElement, scale: number, clientX: number, clientY: number): HTMLElement | null {
  const grid = shell.querySelector<HTMLElement>(`.${READER_GRID_CLASS}`);
  if (!grid) return null;
  if (!grid.style.transformOrigin) {
    const rect = grid.getBoundingClientRect();
    grid.style.transformOrigin = `${clientX - rect.left}px ${clientY - rect.top}px`;
    grid.style.willChange = "transform";
  }
  grid.style.transform = `scale(${scale})`;
  return grid;
}

export function clearWheelPreview(grid: HTMLElement | null): void {
  if (!grid) return;
  grid.style.transform = "";
  grid.style.transformOrigin = "";
  grid.style.willChange = "";
}
