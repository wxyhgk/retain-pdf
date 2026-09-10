// 严格移植旧 pdf-layout.syncReaderPageRows，但用 React 状态回写，
// 避免 DOM 改 minHeight 被 React style 冲掉。

import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  getPageAttr,
  pageSlotSelector,
} from "./reader-dom-contract.js";

export type PageRowHeights = ReadonlyMap<number, number>;

function measureNaturalPageHeight(slot: HTMLElement): number {
  // 优先量「纸面」内容，不吃已被抬高的 minHeight
  const content = slot.querySelector<HTMLElement>(
    "canvas, .react-pdf__Page, .reader-react-pdf-page, .reader-react-pdf-page-placeholder",
  );
  if (content) {
    const h = content.getBoundingClientRect().height;
    if (Number.isFinite(h) && h > 0) {
      return h;
    }
  }
  const natural = Number(slot.getAttribute("data-natural-height"));
  if (Number.isFinite(natural) && natural > 0) {
    return natural;
  }
  const h = slot.getBoundingClientRect().height;
  return Number.isFinite(h) && h > 0 ? h : 0;
}

function mapsEqual(a: PageRowHeights, b: PageRowHeights): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of b) {
    if (a.get(k) !== v) return false;
  }
  return true;
}

/**
 * @returns pageNumber → max(naturalHeight left, naturalHeight right)
 * 仅当左右都有该页时才有条目（与旧 length < 2 skip 一致）
 *
 * @param onSettle optional; called once per revision cycle after a successful
 * delayed measure (≈300ms), not on every ResizeObserver tick.
 */
export function usePageRowSync(
  shellRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  revision: string | number = "",
  onSettle?: () => void,
): PageRowHeights {
  const [heights, setHeights] = useState<PageRowHeights>(() => new Map());
  const onSettleRef = useRef(onSettle);
  onSettleRef.current = onSettle;

  useLayoutEffect(() => {
    if (!enabled) {
      setHeights((prev) => (prev.size === 0 ? prev : new Map()));
      return;
    }

    let cancelled = false;
    let raf = 0;
    /** After the 300ms delayed measure, allow a single settle callback. */
    let settleArmed = false;
    let settled = false;

    const apply = () => {
      if (cancelled) return;
      const shell = shellRef.current;
      if (!shell) return;

      const rows = new Map<number, { height: number; count: number }>();
      shell.querySelectorAll<HTMLElement>(pageSlotSelector()).forEach((slot) => {
        const page = getPageAttr(slot);
        if (!Number.isFinite(page) || page < 1) return;
        const h = measureNaturalPageHeight(slot);
        if (h <= 0) return;
        const row = rows.get(page) || { height: 0, count: 0 };
        row.height = Math.max(row.height, h);
        row.count += 1;
        rows.set(page, row);
      });

      const next = new Map<number, number>();
      rows.forEach((row, page) => {
        // 旧逻辑：两侧都有才同步
        if (row.count >= 2 && row.height > 0) {
          next.set(page, Math.ceil(row.height));
        }
      });

      setHeights((prev) => (mapsEqual(prev, next) ? prev : next));

      // Once per revision: after delayed (300ms+) successful measure — not RO spam
      if (settleArmed && !settled) {
        settled = true;
        onSettleRef.current?.();
      }
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        requestAnimationFrame(apply);
      });
    };

    schedule();
    const t1 = window.setTimeout(schedule, 100);
    const t2 = window.setTimeout(() => {
      settleArmed = true;
      schedule();
    }, 300);
    const t3 = window.setTimeout(schedule, 700);

    const shell = shellRef.current;
    let ro: ResizeObserver | null = null;
    if (shell && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => schedule());
      ro.observe(shell);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      ro?.disconnect();
    };
  }, [shellRef, enabled, revision]);

  return heights;
}
