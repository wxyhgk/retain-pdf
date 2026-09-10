// URL 锚点 → react-pdf 跳页。
//
// 收藏 / 搜索 / 引用回跳会在 URL 上带 ?page_idx=&block_id=（page_idx 0 基）。
// Legacy 引擎在 boot 里 scheduleAnchorJump；默认 react-pdf 路径此前只
// void resolveReaderAnchor()，等于没跳。本 hook 在 PDF 就绪且总页数可知后
// 跳到 page_idx+1，并用短延迟重试以等页槽布局。
//
// block_id 优先由 regions 映射到页；无 region 时退化到 page_idx。

import { useEffect, useRef } from "react";
import { resolveReaderAnchor } from "../external.js";

export type UrlReaderAnchor = {
  pageIdx: number | null;
  blockId: string;
};

/** page_idx (0-based) → 阅读器页码 (1-based)；无效返回 null */
export function pageNumberFromUrlAnchor(
  anchor: UrlReaderAnchor | null | undefined,
  resolveBlockPage?: (blockId: string) => number | null,
): number | null {
  if (!anchor) return null;
  if (anchor.blockId && resolveBlockPage) {
    const regionPage = resolveBlockPage(anchor.blockId);
    if (regionPage != null && Number.isFinite(regionPage) && regionPage >= 1) {
      return Math.floor(regionPage);
    }
  }
  // 勿 Number(null)===0，否则「仅有 block_id」会被误当成第 1 页
  if (anchor.pageIdx === null || anchor.pageIdx === undefined) return null;
  const raw = Number(anchor.pageIdx);
  if (!Number.isFinite(raw)) return null;
  const page = Math.floor(raw) + 1;
  return page >= 1 ? page : null;
}

const JUMP_DELAYS_MS = [0, 80, 200, 400, 800];

/**
 * 在 enabled 且 numPages 可用时，按 URL 锚点跳一次（每会话一次）。
 */
export function useUrlAnchorJump(options: {
  /** boot 完成、可滚动 */
  enabled: boolean;
  numPages: number;
  goToPage: (page: number) => void;
  resolveBlockPage?: (blockId: string) => number | null;
  onAnchorApplied?: (anchor: UrlReaderAnchor, page: number) => void;
}) {
  const { enabled, numPages, goToPage, resolveBlockPage, onAnchorApplied } = options;
  const appliedKeyRef = useRef("");
  const goToPageRef = useRef(goToPage);
  goToPageRef.current = goToPage;
  const resolveBlockPageRef = useRef(resolveBlockPage);
  resolveBlockPageRef.current = resolveBlockPage;
  const onAnchorAppliedRef = useRef(onAnchorApplied);
  onAnchorAppliedRef.current = onAnchorApplied;

  useEffect(() => {
    if (!enabled || !Number.isFinite(numPages) || numPages < 1) {
      return;
    }

    const anchor = resolveReaderAnchor() as UrlReaderAnchor | null;
    const page = pageNumberFromUrlAnchor(anchor, resolveBlockPageRef.current);
    // 无有效页码：视为已处理，避免后续反复读 URL
    const key = page == null
      ? `none:${anchor?.blockId || ""}`
      : `p:${page}:b:${anchor?.blockId || ""}`;
    if (appliedKeyRef.current === key) {
      return;
    }
    if (page == null) {
      appliedKeyRef.current = key;
      return;
    }

    appliedKeyRef.current = key;
    if (anchor) onAnchorAppliedRef.current?.(anchor, page);
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
