// URL anchor -> nhảy trang trong react-pdf.
//
// Favorite / search / citation jump-back mang ?page_idx=&block_id= trong URL (page_idx 0-based).
// Legacy engine scheduleAnchorJump trong boot; đường react-pdf mặc định trước đây chỉ
// void resolveReaderAnchor(), tức là không nhảy. Hook này nhảy tới page_idx+1 sau khi PDF sẵn sàng
// và biết tổng trang, đồng thời retry ngắn để chờ page slot layout.
//
// block_id: react-pdf chưa có region layer, chỉ nhảy cấp trang.

import { useEffect, useRef } from "react";
import { resolveReaderAnchor } from "../external.js";

export type UrlReaderAnchor = {
  pageIdx: number | null;
  blockId: string;
};

/** page_idx (0-based) -> số trang reader (1-based); không hợp lệ trả null. */
export function pageNumberFromUrlAnchor(
  anchor: UrlReaderAnchor | null | undefined,
): number | null {
  if (!anchor) return null;
  // Không dùng Number(null)===0, nếu không case "chỉ có block_id" sẽ bị hiểu nhầm là trang 1.
  if (anchor.pageIdx === null || anchor.pageIdx === undefined) return null;
  const raw = Number(anchor.pageIdx);
  if (!Number.isFinite(raw)) return null;
  const page = Math.floor(raw) + 1;
  return page >= 1 ? page : null;
}

const JUMP_DELAYS_MS = [0, 80, 200, 400, 800];

/**
 * Khi enabled và numPages có sẵn, nhảy theo URL anchor một lần (mỗi session một lần).
 */
export function useUrlAnchorJump(options: {
  /** Boot hoàn tất, có thể cuộn. */
  enabled: boolean;
  numPages: number;
  goToPage: (page: number) => void;
}) {
  const { enabled, numPages, goToPage } = options;
  const appliedKeyRef = useRef("");
  const goToPageRef = useRef(goToPage);
  goToPageRef.current = goToPage;

  useEffect(() => {
    if (!enabled || !Number.isFinite(numPages) || numPages < 1) {
      return;
    }

    const anchor = resolveReaderAnchor() as UrlReaderAnchor | null;
    const page = pageNumberFromUrlAnchor(anchor);
    // Không có số trang hợp lệ: xem như đã xử lý để tránh đọc URL lặp lại.
    const key = page == null
      ? `none:${anchor?.blockId || ""}`
      : `p:${page}`;
    if (appliedKeyRef.current === key) {
      return;
    }
    if (page == null) {
      appliedKeyRef.current = key;
      return;
    }

    appliedKeyRef.current = key;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const delay of JUMP_DELAYS_MS) {
      timers.push(
        setTimeout(() => {
          goToPageRef.current(page);
        }, delay),
      );
    }
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [enabled, numPages]);
}
