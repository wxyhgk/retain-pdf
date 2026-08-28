// Ước tính trang hiện tại (1-based) dựa trên đường tiêu điểm đọc trong shell cuộn chia sẻ.
// Sử dụng cùng quy tắc pickPageAtFocus với measurePageScrollProgress / anchor cuộn.

import { useEffect, useState } from "react";
import type { RefObject } from "react";
import {
  pageSelector,
  type ReaderPaneId,
} from "./reader-dom-contract.js";
import {
  pickPageAtFocus,
  readingFocusY,
} from "./scroll-to-page.js";

export function useCurrentPage(
  scrollRef: RefObject<HTMLElement | null>,
  numPages: number,
  enabled = true,
  /** Rebind khi zoom / mode làm node thay đổi. */
  observeKey: string | number = "",
  /** Chỉ xét page của một pane; rỗng thì xét tất cả. */
  pane?: ReaderPaneId | null,
): number {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!enabled || numPages <= 0) {
      setCurrentPage(1);
      return;
    }
    const root = scrollRef.current;
    if (!root) {
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let rafId = 0;

    const selector = pageSelector(undefined, pane);

    const measure = () => {
      if (cancelled) return;
      const pages = Array.from(root.querySelectorAll<HTMLElement>(selector));
      if (!pages.length) {
        return;
      }
      const focusY = readingFocusY(root);
      const picked = pickPageAtFocus(pages, focusY);
      if (picked) {
        setCurrentPage(picked.page);
      }
    };

    const scheduleMeasure = () => {
      if (cancelled) return;
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        measure();
      });
    };

    const attach = () => {
      if (cancelled) return;
      const pages = Array.from(root.querySelectorAll<HTMLElement>(selector));
      if (!pages.length) {
        retryTimer = setTimeout(attach, 120);
        return;
      }
      measure();
      root.addEventListener("scroll", scheduleMeasure, { passive: true });
    };

    attach();

    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      root.removeEventListener("scroll", scheduleMeasure);
    };
  }, [scrollRef, numPages, enabled, observeKey, pane]);

  return currentPage;
}
