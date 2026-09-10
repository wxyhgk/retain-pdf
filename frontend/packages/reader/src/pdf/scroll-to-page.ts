// 共享滚动壳定位：按「页 + 页内比例」恢复阅读位置。
// 模式切换时必须用切换前锁定的 progress，禁止在恢复过程中重新 measure（会漂到末页）。

import {
  getPageAttr,
  pageSelector,
  type ReaderPaneId,
} from "./reader-dom-contract.js";

export type PageScrollProgress = {
  page: number;
  fraction: number;
};

/** 视口内「阅读线」相对滚动容器顶的偏移（与 measure/apply / HUD 当前页必须一致） */
export const READER_SCROLL_FOCUS_PX = 48;

/** Y coordinate of reading focus line in viewport coords */
export function readingFocusY(
  root: HTMLElement,
  readingOffsetPx = READER_SCROLL_FOCUS_PX,
): number {
  return root.getBoundingClientRect().top + readingOffsetPx;
}

/**
 * Pick best page element under focus line from a list of [data-reader-page] elements.
 * Focus rule: last page with size>=8 whose top <= focusY+1; else first below / last above.
 */
export function pickPageAtFocus(
  pages: HTMLElement[],
  focusY: number,
): { el: HTMLElement; page: number; fraction: number } | null {
  if (!pages.length) {
    return null;
  }

  let best: HTMLElement | null = null;
  let bestTop = -Infinity;
  for (const el of pages) {
    const rect = el.getBoundingClientRect();
    // 隐藏栏 / 未布局：跳过，避免量到 0 高导致误判末页
    if (rect.height < 8 || rect.width < 8) {
      continue;
    }
    if (rect.top <= focusY + 1 && rect.top >= bestTop) {
      best = el;
      bestTop = rect.top;
    }
  }

  if (!best) {
    // 全部在阅读线下方 → 第一页；全部在上方 → 最后一页
    const first = pages.find((el) => {
      const r = el.getBoundingClientRect();
      return r.height >= 8 && r.width >= 8;
    });
    best = first ?? pages[0] ?? null;
    if (best) {
      const lastVisible = [...pages].reverse().find((el) => {
        const r = el.getBoundingClientRect();
        return r.height >= 8 && r.width >= 8;
      });
      if (lastVisible) {
        const lastRect = lastVisible.getBoundingClientRect();
        if (lastRect.bottom < focusY) {
          best = lastVisible;
        }
      }
    }
  }

  if (!best) {
    return null;
  }

  const page = getPageAttr(best);
  if (!Number.isFinite(page) || page < 1) {
    return null;
  }

  const rect = best.getBoundingClientRect();
  const height = rect.height > 0 ? rect.height : 1;
  const fraction = Math.min(1, Math.max(0, (focusY - rect.top) / height));
  return { el: best, page, fraction };
}

export function measurePageScrollProgress(
  root: HTMLElement | null | undefined,
  pane?: ReaderPaneId | null,
  readingOffsetPx = READER_SCROLL_FOCUS_PX,
): PageScrollProgress | null {
  if (!root) {
    return null;
  }
  const selector = pageSelector(undefined, pane);
  const pages = Array.from(root.querySelectorAll<HTMLElement>(selector));
  if (!pages.length) {
    return null;
  }
  const rootRect = root.getBoundingClientRect();
  if (rootRect.height <= 0) {
    return null;
  }
  const focusY = readingFocusY(root, readingOffsetPx);
  const picked = pickPageAtFocus(pages, focusY);
  if (!picked) {
    return null;
  }
  return { page: picked.page, fraction: picked.fraction };
}

export function applyPageScrollProgress(
  root: HTMLElement | null | undefined,
  progress: PageScrollProgress,
  behavior: ScrollBehavior = "auto",
  pane?: ReaderPaneId | null,
  readingOffsetPx = READER_SCROLL_FOCUS_PX,
): boolean {
  if (!root || !progress) {
    return false;
  }
  const page = Math.max(1, Math.floor(Number(progress.page) || 1));
  const fraction = Math.min(1, Math.max(0, Number(progress.fraction) || 0));
  let el: HTMLElement | null = null;
  if (pane) {
    el = root.querySelector<HTMLElement>(pageSelector(page, pane));
  }
  if (!el) {
    el = root.querySelector<HTMLElement>(pageSelector(page));
  }
  if (!el) {
    return false;
  }
  const rootRect = root.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  // 页尚未布局：失败，等下一轮
  if (rootRect.height <= 0 || (elRect.height < 8 && el.offsetHeight < 8)) {
    return false;
  }
  const pageHeight = elRect.height > 0 ? elRect.height : el.offsetHeight;
  const elTop = root.scrollTop + (elRect.top - rootRect.top);
  const nextTop = Math.max(0, elTop + fraction * pageHeight - readingOffsetPx);
  if (behavior === "auto") {
    root.scrollTop = nextTop;
  } else {
    root.scrollTo({ top: nextTop, behavior });
  }
  return true;
}

export function scrollShellToPage(
  root: HTMLElement | null | undefined,
  pageNumber: number,
  behavior: ScrollBehavior = "smooth",
  pane?: ReaderPaneId | null,
): boolean {
  return applyPageScrollProgress(
    root,
    { page: pageNumber, fraction: 0 },
    behavior,
    pane,
  );
}

/** @deprecated 兼容旧名 */
export function scrollPaneToPage(
  root: HTMLElement | null | undefined,
  pageNumber: number,
  behavior: ScrollBehavior = "smooth",
): boolean {
  return scrollShellToPage(root, pageNumber, behavior);
}

/**
 * 用锁定的 progress 恢复位置。
 * 布局未稳时重试；同一 progress 反复 apply 是幂等的（不会越滚越远）。
 */
export function alignShellToProgress(
  getRoot: () => HTMLElement | null | undefined,
  progress: PageScrollProgress,
  options?: {
    behavior?: ScrollBehavior;
    pane?: ReaderPaneId | null;
    delaysMs?: number[];
    onDone?: () => void;
  },
): () => void {
  const behavior = options?.behavior ?? "auto";
  // 少而稳：等栏宽/页高落稳后再钉几次同一锚点
  const delays = options?.delaysMs ?? [0, 32, 120, 280];
  let cancelled = false;
  let done = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  const run = () => {
    if (cancelled) return;
    const ok = applyPageScrollProgress(
      getRoot(),
      progress,
      behavior,
      options?.pane,
    );
    if (ok && !done) {
      done = true;
      options?.onDone?.();
    }
  };

  for (const ms of delays) {
    if (ms <= 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(run);
      });
    } else {
      timers.push(setTimeout(run, ms));
    }
  }

  return () => {
    cancelled = true;
    for (const t of timers) {
      clearTimeout(t);
    }
  };
}

export function alignShellToPage(
  getRoot: () => HTMLElement | null | undefined,
  pageNumber: number,
  options?: {
    behavior?: ScrollBehavior;
    pane?: ReaderPaneId | null;
    delaysMs?: number[];
    onDone?: () => void;
  },
): () => void {
  return alignShellToProgress(
    getRoot,
    { page: pageNumber, fraction: 0 },
    options,
  );
}

export function clampPageNumber(page: number, numPages: number): number {
  if (!Number.isFinite(page)) {
    return 1;
  }
  const target = Math.max(1, Math.floor(page));
  // 总页未知时不要钳到 1（AI 引用跳转会因此全落第 1 页）
  if (!Number.isFinite(numPages) || numPages <= 0) {
    return target;
  }
  return Math.min(numPages, target);
}

export function cloneProgress(p: PageScrollProgress): PageScrollProgress {
  return {
    page: Math.max(1, Math.floor(Number(p.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(p.fraction) || 0)),
  };
}
