// Mount/visibility hai cột + số trang + revision metrics: tách ra từ ReaderAppReactPdf.

import { useCallback, useMemo, useRef, useState } from "react";
import type { ReaderMode } from "./use-reader-session.js";
import type { ProtectedPdfFile } from "../pdf/useProtectedPdfFile.js";

export type ReaderPaneModelInput = {
  mode: ReaderMode;
  sourceOnly: boolean;
  assetsReady: boolean;
  sourceUrl: string;
  translatedUrl: string;
  sourceFile: ProtectedPdfFile | null;
  translatedFile: ProtectedPdfFile | null;
};

export type ReaderPaneFlags = {
  mountSource: boolean;
  mountTranslated: boolean;
  showSource: boolean;
  showTranslated: boolean;
  compareMode: boolean;
  primaryPane: "source" | "translated";
};

export type ReaderPaneModel = ReaderPaneFlags & {
  numPagesByPane: { source: number; translated: number };
  hudNumPages: number;
  primaryNumPages: number;
  metricsTick: number;
  onNumPages: (pages: number, pane: "source" | "translated") => void;
  onMetrics: () => void;
  /** string for usePageRowSync revision */
  rowSyncRevision: string;
};

/** Pure mount/visibility flags for dual-pane reader (testable without React). */
export function computeReaderPaneFlags(input: {
  mode: ReaderMode;
  sourceOnly: boolean;
  assetsReady: boolean;
  hasSource: boolean;
  hasTranslated: boolean;
}): ReaderPaneFlags {
  const { mode, sourceOnly, assetsReady, hasSource, hasTranslated } = input;

  const mountSource = assetsReady && hasSource;
  const mountTranslated = assetsReady && hasTranslated && !sourceOnly;
  const showSource = mode === "source" || mode === "compare";
  const showTranslated = !sourceOnly
    && (mode === "translated" || mode === "compare");
  const compareMode = mode === "compare" && showSource && showTranslated
    && mountSource && mountTranslated;
  const primaryPane: "source" | "translated" =
    mode === "translated" ? "translated" : "source";

  return {
    mountSource,
    mountTranslated,
    showSource,
    showTranslated,
    compareMode,
    primaryPane,
  };
}

export function useReaderPaneModel(
  input: ReaderPaneModelInput,
  extras?: { userZoom?: number; shellWidth?: number },
): ReaderPaneModel {
  const {
    mode,
    sourceOnly,
    assetsReady,
    sourceUrl,
    sourceFile,
    translatedFile,
  } = input;

  const [numPagesByPane, setNumPagesByPane] = useState({ source: 0, translated: 0 });
  const [metricsTick, setMetricsTick] = useState(0);

  const flags = computeReaderPaneFlags({
    mode,
    sourceOnly,
    assetsReady,
    hasSource: Boolean(sourceFile) || Boolean(sourceUrl),
    hasTranslated: Boolean(translatedFile),
  });
  const { primaryPane } = flags;

  const onNumPages = useCallback((pages: number, pane: "source" | "translated") => {
    setNumPagesByPane((prev) => (
      prev[pane] === pages ? prev : { ...prev, [pane]: pages }
    ));
  }, []);

  const metricsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMetrics = useCallback(() => {
    if (metricsTimerRef.current) clearTimeout(metricsTimerRef.current);
    metricsTimerRef.current = setTimeout(() => {
      setMetricsTick((n) => n + 1);
    }, 60);
  }, []);

  const hudNumPages = useMemo(
    () => Math.max(numPagesByPane.source, numPagesByPane.translated),
    [numPagesByPane],
  );

  const primaryNumPages = primaryPane === "translated"
    ? numPagesByPane.translated
    : numPagesByPane.source || numPagesByPane.translated;

  const userZoom = extras?.userZoom;
  const shellWidth = extras?.shellWidth;
  const rowSyncRevision = `${metricsTick}-${userZoom}-${mode}-${numPagesByPane.source}-${numPagesByPane.translated}-${shellWidth}`;

  return {
    ...flags,
    numPagesByPane,
    hudNumPages,
    primaryNumPages,
    metricsTick,
    onNumPages,
    onMetrics,
    rowSyncRevision,
  };
}
