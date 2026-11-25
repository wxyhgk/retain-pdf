// 第二栏（宿主提供的页签，见 contracts/side-pane.ts）：这本书有没有、给宿主的那几样能力、页边小圆点。
//
// 开合本身不在这里：它就是「开着哪个面板」里的 `side`（use-reader-assistant-panel），
// 和 Markdown 面板共用一份状态 —— 同一时间只开一个、按书记住、换书不串。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ReaderAnchor,
  ReaderAnchorJump,
  ReaderMarginMarker,
  ReaderMarginMarkerTone,
  ReaderSidePaneApi,
  ReaderSidePanePort,
} from "../contracts/side-pane.js";
import {
  findReaderRegion,
  findReaderRegionByCitation,
  regionBoxForPane,
  type ReaderRegion,
} from "../shared/data/reader-regions.js";

/** 一个圆点落在哪一页、挂在哪一块上（找不到块就画在页顶）。 */
export type ResolvedMarginMarker = {
  key: string;
  page: number;
  itemId: string | null;
  tone: ReaderMarginMarkerTone;
  hollow: boolean;
  label: string;
};

export type MarginMarkersByPage = ReadonlyMap<number, readonly ResolvedMarginMarker[]>;

/** 锚点 → 书里的那一块：块编号优先，其次「那一页上的这段原文」。 */
export function resolveAnchorRegion(regions: readonly ReaderRegion[], anchor: ReaderAnchor): ReaderRegion | null {
  return findReaderRegion(regions, anchor.itemId)
    || findReaderRegionByCitation(regions, { page: anchor.page, snippet: anchor.quote });
}

export function resolveMarginMarkers(
  regions: readonly ReaderRegion[],
  markers: readonly ReaderMarginMarker[],
  pane: "source" | "translated",
): MarginMarkersByPage {
  const byPage = new Map<number, ResolvedMarginMarker[]>();
  for (const marker of markers) {
    const region = resolveAnchorRegion(regions, marker.anchor);
    const page = region ? regionBoxForPane(region, pane).page : Math.floor(Number(marker.anchor.page));
    if (!Number.isFinite(page) || page < 1) continue;
    const list = byPage.get(page) ?? [];
    list.push({
      key: marker.key,
      page,
      itemId: region?.itemId ?? null,
      tone: marker.tone,
      hollow: Boolean(marker.hollow),
      label: marker.label,
    });
    byPage.set(page, list);
  }
  return byPage;
}

const EMPTY_MARKERS: MarginMarkersByPage = new Map();

export type ReaderSidePaneState = {
  port: ReaderSidePanePort | null;
  /** 这本书出不出这个页签。 */
  available: boolean;
  label: string;
  /** 给宿主内容的能力；没打开时为 null。 */
  api: ReaderSidePaneApi | null;
  /** 开着时按页分好的小圆点；关着时是空的（原文 / 对照 / 译文里不画）。 */
  markersByPage: MarginMarkersByPage;
  selectMarker: (key: string) => void;
};

export function useReaderSidePane(input: {
  port: ReaderSidePanePort | null | undefined;
  open: boolean;
  documentId: string;
  jobId: string;
  currentPage: number;
  regions: readonly ReaderRegion[];
  pane: "source" | "translated";
  jumpToAnchor: (target: { block_id?: string; page?: number; snippet?: string }) => ReaderAnchorJump;
  close: () => void;
}): ReaderSidePaneState {
  const { port, open, documentId, jobId, currentPage, regions, pane, jumpToAnchor, close } = input;
  const available = useMemo(() => {
    if (!port) return false;
    try {
      return Boolean(port.isAvailableFor({ documentId, jobId }));
    } catch {
      return false;
    }
  }, [port, documentId, jobId]);

  const [markers, setMarkers] = useState<readonly ReaderMarginMarker[]>([]);
  const onSelectRef = useRef<((key: string) => void) | undefined>(undefined);
  // 换书就清掉上一本书的圆点。
  useEffect(() => {
    setMarkers([]);
    onSelectRef.current = undefined;
  }, [documentId, jobId]);

  const setMarginMarkers = useCallback((next: readonly ReaderMarginMarker[], onSelect?: (key: string) => void) => {
    onSelectRef.current = onSelect;
    setMarkers(next);
  }, []);
  const selectMarker = useCallback((key: string) => onSelectRef.current?.(key), []);

  const navigateToAnchor = useCallback((anchor: ReaderAnchor): ReaderAnchorJump => jumpToAnchor({
    ...(anchor.itemId ? { block_id: anchor.itemId } : {}),
    page: anchor.page,
    ...(anchor.quote ? { snippet: anchor.quote } : {}),
  }), [jumpToAnchor]);

  const api = useMemo<ReaderSidePaneApi | null>(() => (open && available ? {
    documentId,
    jobId,
    currentPage,
    navigateToAnchor,
    setMarginMarkers,
    close,
  } : null), [open, available, documentId, jobId, currentPage, navigateToAnchor, setMarginMarkers, close]);

  const markersByPage = useMemo(
    () => (open && available && markers.length ? resolveMarginMarkers(regions, markers, pane) : EMPTY_MARKERS),
    [open, available, markers, regions, pane],
  );

  return {
    port: port ?? null,
    available,
    label: port?.label || "",
    api,
    markersByPage,
    selectMarker,
  };
}
