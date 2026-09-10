// 阅读器缩放：100% = 适应当前栏宽；变更时保持视口中心不偏右/上跳。

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  clampReaderZoom,
  defaultZoomForMode,
  preserveScrollCenter,
  stepReaderZoom,
} from "../pdf/reader-zoom.js";
import {
  loadReaderViewState,
  saveReaderViewState,
} from "../shared/state/reader-view-state.js";

export type ReaderZoomApi = {
  userZoom: number;
  onZoomChange: (zoom: number) => void;
  stepZoom: (direction: 1 | -1) => void;
  resetZoom: (mode?: string) => void;
};

export function useReaderZoom(
  initialMode?: string,
  shellRef?: RefObject<HTMLElement | null>,
  persistenceKey = "",
): ReaderZoomApi {
  const [userZoom, setUserZoom] = useState(() => (
    loadReaderViewState(persistenceKey)?.zoom ?? defaultZoomForMode(initialMode)
  ));
  const zoomRef = useRef(userZoom);
  const persistenceKeyRef = useRef(persistenceKey);
  zoomRef.current = userZoom;
  const pendingRatioRef = useRef(1);

  useEffect(() => {
    if (persistenceKeyRef.current === persistenceKey) return;
    persistenceKeyRef.current = persistenceKey;
    const next = loadReaderViewState(persistenceKey)?.zoom ?? defaultZoomForMode(initialMode);
    pendingRatioRef.current = 1;
    zoomRef.current = next;
    setUserZoom(next);
  }, [initialMode, persistenceKey]);

  const onZoomChange = useCallback((zoom: number) => {
    const next = clampReaderZoom(zoom);
    const prev = zoomRef.current;
    if (Math.abs(next - prev) < 0.0005) {
      return;
    }
    pendingRatioRef.current = next / (prev || 1);
    saveReaderViewState(persistenceKeyRef.current, { zoom: next });
    setUserZoom(next);
  }, []);

  const stepZoom = useCallback((direction: 1 | -1) => {
    onZoomChange(stepReaderZoom(zoomRef.current, direction));
  }, [onZoomChange]);

  const resetZoom = useCallback((mode?: string) => {
    onZoomChange(defaultZoomForMode(mode));
  }, [onZoomChange]);

  // 页宽变更提交后，按比例把滚动钉回视口中心
  useLayoutEffect(() => {
    const ratio = pendingRatioRef.current;
    if (Math.abs(ratio - 1) < 0.001) {
      return;
    }
    pendingRatioRef.current = 1;
    preserveScrollCenter(shellRef?.current, ratio);
  }, [userZoom, shellRef]);

  return { userZoom, onZoomChange, stepZoom, resetZoom };
}
