// 阅读器缩放：100% = 适应当前栏宽；变更时保持视口中心不偏右/上跳。

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  clampReaderZoom,
  defaultZoomForMode,
  preserveScrollCenter,
  readerViewportWidth,
  stepReaderZoom,
} from "../pdf/reader-zoom.js";
import {
  loadReaderViewState,
  saveReaderViewState,
} from "../shared/state/reader-view-state.js";

export type ReaderZoomChangeOptions = {
  /** 默认 true：按比例把视口中心钉住。滚轮缩放自己按鼠标位置对齐，传 false。 */
  keepScroll?: boolean;
};

export type ReaderZoomChange = (zoom: number, options?: ReaderZoomChangeOptions) => void;

export type ReaderZoomApi = {
  userZoom: number;
  onZoomChange: ReaderZoomChange;
  stepZoom: (direction: 1 | -1) => void;
  resetZoom: (mode?: string) => void;
};

export function useReaderZoom(
  initialMode?: string,
  shellRef?: RefObject<HTMLElement | null>,
  persistenceKey = "",
): ReaderZoomApi {
  const [userZoom, setUserZoom] = useState(() => (
    loadReaderViewState(persistenceKey)?.zoom ?? defaultZoomForMode(initialMode, readerViewportWidth())
  ));
  const zoomRef = useRef(userZoom);
  const persistenceKeyRef = useRef(persistenceKey);
  zoomRef.current = userZoom;
  const pendingRatioRef = useRef(1);
  // 当前缩放是不是用户选的（存档里有，或本次会话里调过）。不是的话它只是「模式
  // 默认」，模式变了要跟着变 —— 窄屏上单栏默认 100%、对照默认 50%，开书时会话先是
  // 对照、恢复/窄屏默认再切到译文，停在 50% 的话单栏页宽只有半屏。
  const chosenRef = useRef(loadReaderViewState(persistenceKey)?.zoom !== undefined);

  useEffect(() => {
    if (persistenceKeyRef.current === persistenceKey) return;
    persistenceKeyRef.current = persistenceKey;
    const saved = loadReaderViewState(persistenceKey)?.zoom;
    chosenRef.current = saved !== undefined;
    const next = saved ?? defaultZoomForMode(initialMode, readerViewportWidth());
    pendingRatioRef.current = 1;
    zoomRef.current = next;
    setUserZoom(next);
  }, [initialMode, persistenceKey]);

  // 用户没选过缩放时，模式默认跟着模式走；只改显示，不写存档（写了就成了「选过」）。
  useEffect(() => {
    if (chosenRef.current) return;
    const next = defaultZoomForMode(initialMode, readerViewportWidth());
    const prev = zoomRef.current;
    if (Math.abs(next - prev) < 0.0005) return;
    // 不按比例钉视口中心：这是跟着换模式一起发生的，换模式自己会冻结并恢复阅读
    // 锚点（页 + 页内比例，见 beginModeSwitch），两套一起拉滚动条会互相打架。
    pendingRatioRef.current = 1;
    zoomRef.current = next;
    setUserZoom(next);
  }, [initialMode]);

  const onZoomChange = useCallback<ReaderZoomChange>((zoom, options) => {
    const next = clampReaderZoom(zoom);
    const prev = zoomRef.current;
    if (Math.abs(next - prev) < 0.0005) {
      return;
    }
    pendingRatioRef.current = options?.keepScroll === false ? 1 : next / (prev || 1);
    zoomRef.current = next;
    chosenRef.current = true;
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
