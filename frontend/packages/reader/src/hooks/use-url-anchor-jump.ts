// URL 锚点 ↔ react-pdf 阅读位置 双向同步。
//
// 读取方向（原逻辑）：
//   收藏 / 搜索 / 引用回跳会在 URL 上带 ?page_idx=&block_id=（page_idx 0 基）。
//   本 hook 在 PDF 就绪且总页数可知后跳到 page_idx+1，并用短延迟重试以等页槽布局。
//   block_id 优先由 regions 映射到页；无 region 时退化到 page_idx。
//
// 写入方向（新增）：
//   阅读中把当前页按防抖用 history.replaceState 写回 URL 的 page_idx（0 基），
//   使分享 / 刷新能回到当前位置。只用 replaceState，不 push，避免污染返回历史。
//   写入的位置会同步标记进 appliedKeyRef，锚点跳转据此识别「这是自己刚写的」，
//   不会再把写入当成一次待跳锚点，从而杜绝「写 → 跳」回环。

import { useCallback, useEffect, useRef, useState } from "react";
import { resolveReaderAnchor } from "../external.js";
import { buildReaderPageIdxSearch } from "../shared/config/page-config.js";

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
/**
 * 去重键：混入会话身份（jobId/documentId），跨文档同 anchor 不再互相吞跳。
 * 同会话同 anchor 保持稳定，仍只跳一次。
 */
export function buildUrlAnchorAppliedKey(
  anchor: UrlReaderAnchor | null | undefined,
  page: number | null,
  session?: { jobId?: string | null; documentId?: string | null },
): string {
  const jobId = `${session?.jobId || ""}`.trim();
  const documentId = `${session?.documentId || ""}`.trim();
  const scope = `j:${jobId}:d:${documentId}`;
  if (page == null) {
    return `${scope}:none:${anchor?.blockId || ""}`;
  }
  return `${scope}:p:${page}:b:${anchor?.blockId || ""}`;
}

const JUMP_DELAYS_MS = [0, 80, 200, 400, 800];
/** 最后一次重试后再多等一会，让滚动 / 页槽布局把 currentPage 落定，URL 同步才开闸 */
const JUMP_SETTLE_EXTRA_MS = 120;

/** 阅读位置写回 URL 的防抖窗口 */
export const DEFAULT_URL_PAGE_SYNC_DEBOUNCE_MS = 400;

type AppliedKeyRef = { current: string };

export type UrlAnchorJumpOptions = {
  /** boot 完成、可滚动 */
  enabled: boolean;
  numPages: number;
  goToPage: (page: number) => void;
  resolveBlockPage?: (blockId: string) => number | null;
  onAnchorApplied?: (anchor: UrlReaderAnchor, page: number) => void;
  /** 会话身份：跨文档同 anchor 不跳的根因，缺席时退化为旧全局去重 */
  jobId?: string | null;
  documentId?: string | null;
  /**
   * 块（regions）到了没有：它们不挡着露页面，比页面晚到。只给了 block_id 的锚点要等它们才知道是哪一页；
   * 同时给了 page_idx 的先按页跳，块到了再按块所在的页校一次。缺省当已经到了（旧行为）。
   */
  regionsSettled?: boolean;
};

function useUrlAnchorJumpCore(
  options: UrlAnchorJumpOptions,
  appliedKeyRef: AppliedKeyRef,
  onSettled?: () => void,
): void {
  const { enabled, numPages, goToPage, resolveBlockPage, onAnchorApplied, jobId, documentId, regionsSettled = true } = options;
  const goToPageRef = useRef(goToPage);
  goToPageRef.current = goToPage;
  const resolveBlockPageRef = useRef(resolveBlockPage);
  resolveBlockPageRef.current = resolveBlockPage;
  const onAnchorAppliedRef = useRef(onAnchorApplied);
  onAnchorAppliedRef.current = onAnchorApplied;
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  useEffect(() => {
    if (!enabled || !Number.isFinite(numPages) || numPages < 1) {
      return;
    }

    const anchor = resolveReaderAnchor() as UrlReaderAnchor | null;
    const page = pageNumberFromUrlAnchor(anchor, resolveBlockPageRef.current);
    // 只有块、块还没到：先不算处理过（也不放 URL 写回），块到了再来。
    if (page == null && anchor?.blockId && !regionsSettled) return;
    // 无有效页码：视为已处理，避免后续反复读 URL
    const key = buildUrlAnchorAppliedKey(anchor, page, { jobId, documentId });
    if (appliedKeyRef.current === key) {
      return;
    }
    if (page == null) {
      appliedKeyRef.current = key;
      onSettledRef.current?.();
      return;
    }

    appliedKeyRef.current = key;
    if (anchor) onAnchorAppliedRef.current?.(anchor, page);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let lastDelay = 0;
    for (const delay of JUMP_DELAYS_MS) {
      lastDelay = Math.max(lastDelay, delay);
      timers.push(
        setTimeout(() => {
          goToPageRef.current(page);
        }, delay),
      );
    }
    timers.push(
      setTimeout(() => {
        onSettledRef.current?.();
      }, lastDelay + JUMP_SETTLE_EXTRA_MS),
    );
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [enabled, numPages, jobId, documentId, appliedKeyRef, regionsSettled]);
}

/**
 * 在 enabled 且 numPages 可用时，按 URL 锚点跳一次（每会话一次）。
 */
export function useUrlAnchorJump(options: UrlAnchorJumpOptions): void {
  const appliedKeyRef = useRef("");
  useUrlAnchorJumpCore(options, appliedKeyRef);
}

/**
 * 把 reader 自身 location 的 query 替换成 search。
 * 只写当前 window（软阅读 iframe 内即 iframe 自己），绝不触碰父页 URL。
 */
export function replaceReaderLocationSearch(search: string): void {
  const win = globalThis.window;
  if (!win || typeof win.history?.replaceState !== "function") return;
  const loc = win.location;
  const query = `${search || ""}`;
  const href = `${loc.pathname}${query ? `?${query}` : ""}${loc.hash || ""}`;
  // 必须 replaceState：不新增历史项，返回键不会逐页回退。
  win.history.replaceState(null, "", href);
}

export type UrlReaderAnchorSyncOptions = UrlAnchorJumpOptions & {
  /** 阅读位置已就绪、可写回 URL */
  syncEnabled: boolean;
  /** 当前页（1 基） */
  currentPage: number;
  syncDebounceMs?: number;
  /** 测试 / 宿主注入；默认写 reader 自身 location 的 history.replaceState */
  applyReaderSearch?: (search: string) => void;
};

function useUrlPageSyncCore(
  options: UrlReaderAnchorSyncOptions,
  appliedKeyRef: AppliedKeyRef,
  anchorSettled: boolean,
): void {
  const {
    syncEnabled,
    currentPage,
    resolveBlockPage,
    syncDebounceMs = DEFAULT_URL_PAGE_SYNC_DEBOUNCE_MS,
    jobId,
    documentId,
    applyReaderSearch,
  } = options;
  const resolveBlockPageRef = useRef(resolveBlockPage);
  resolveBlockPageRef.current = resolveBlockPage;
  const applyReaderSearchRef = useRef(applyReaderSearch);
  applyReaderSearchRef.current = applyReaderSearch;
  /** 已写入 URL 的页码：值不变就不重复写 */
  const lastWrittenPageRef = useRef(0);

  useEffect(() => {
    // 锚点尚未落定、或阅读位置未就绪：不写，避免覆盖启动锚点。
    if (!anchorSettled || !syncEnabled) return;
    if (!appliedKeyRef.current) return;
    if (!Number.isFinite(currentPage) || currentPage < 1) return;
    if (lastWrittenPageRef.current === currentPage) return;

    const timer = setTimeout(() => {
      const search = globalThis.location?.search || "";
      const next = buildReaderPageIdxSearch(search, currentPage, resolveBlockPageRef.current);
      lastWrittenPageRef.current = currentPage;
      if (next === null) return;
      // 把刚写回的位置标记为已应用：锚点跳转据此跳过，防止「写 → 跳」回环。
      const writtenBlockId = `${new URLSearchParams(next).get("block_id") || ""}`.trim();
      appliedKeyRef.current = buildUrlAnchorAppliedKey(
        { pageIdx: currentPage - 1, blockId: writtenBlockId },
        currentPage,
        { jobId, documentId },
      );
      (applyReaderSearchRef.current || replaceReaderLocationSearch)(next);
    }, syncDebounceMs);
    return () => clearTimeout(timer);
  }, [
    anchorSettled,
    syncEnabled,
    currentPage,
    syncDebounceMs,
    jobId,
    documentId,
    appliedKeyRef,
  ]);
}

/**
 * 组合锚点读取跳转 + 阅读位置写回 URL。
 * 两条方向共享同一个 appliedKeyRef，保证写回值不会被当成待跳锚点。
 */
export function useReaderUrlAnchorSync(options: UrlReaderAnchorSyncOptions): void {
  const appliedKeyRef = useRef("");
  const [anchorSettled, setAnchorSettled] = useState(false);
  const handleSettled = useCallback(() => setAnchorSettled(true), []);

  const jumpOptions: UrlAnchorJumpOptions = {
    enabled: options.enabled,
    numPages: options.numPages,
    goToPage: options.goToPage,
    resolveBlockPage: options.resolveBlockPage,
    onAnchorApplied: options.onAnchorApplied,
    jobId: options.jobId,
    documentId: options.documentId,
    regionsSettled: options.regionsSettled,
  };
  // jump core 在锚点落定后置位 anchorSettled，写回方向才开闸。
  useUrlAnchorJumpCore(jumpOptions, appliedKeyRef, handleSettled);
  useUrlPageSyncCore(options, appliedKeyRef, anchorSettled);
}
