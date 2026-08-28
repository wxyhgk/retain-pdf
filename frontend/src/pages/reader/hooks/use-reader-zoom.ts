// Zoom reader: 100% = fit chiều rộng cột hiện tại; khi đổi zoom giữ tâm viewport không lệch phải/nhảy lên.

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  clampReaderZoom,
  defaultZoomForMode,
  preserveScrollCenter,
  stepReaderZoom,
} from "../pdf/reader-zoom.js";

export type ReaderZoomApi = {
  userZoom: number;
  onZoomChange: (zoom: number) => void;
  stepZoom: (direction: 1 | -1) => void;
  resetZoom: (mode?: string) => void;
};

export function useReaderZoom(
  initialMode?: string,
  shellRef?: RefObject<HTMLElement | null>,
): ReaderZoomApi {
  const [userZoom, setUserZoom] = useState(() => defaultZoomForMode(initialMode));
  const zoomRef = useRef(userZoom);
  zoomRef.current = userZoom;
  const pendingRatioRef = useRef(1);

  const onZoomChange = useCallback((zoom: number) => {
    const next = clampReaderZoom(zoom);
    const prev = zoomRef.current;
    if (Math.abs(next - prev) < 0.0005) {
      return;
    }
    pendingRatioRef.current = next / (prev || 1);
    setUserZoom(next);
  }, []);

  const stepZoom = useCallback((direction: 1 | -1) => {
    onZoomChange(stepReaderZoom(zoomRef.current, direction));
  }, [onZoomChange]);

  const resetZoom = useCallback((mode?: string) => {
    onZoomChange(defaultZoomForMode(mode));
  }, [onZoomChange]);

  // Sau khi thay đổi page width commit, ghim scroll về tâm viewport theo tỷ lệ.
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
