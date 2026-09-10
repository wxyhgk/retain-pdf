// 双栏挂载/可见性 + 页数 + metrics 修订：从 ReaderAppReactPdf 抽出。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  extras?: { userZoom?: number; shellWidth?: number; identityKey?: string },
): ReaderPaneModel {
  const {
    mode,
    sourceOnly,
    assetsReady,
    sourceUrl,
    translatedUrl,
    sourceFile,
    translatedFile,
  } = input;

  const paneIdentity = `${extras?.identityKey || ""}\u0000${sourceUrl}\u0000${translatedUrl}`;
  const activeIdentityRef = useRef(paneIdentity);
  activeIdentityRef.current = paneIdentity;
  const [pageState, setPageState] = useState(() => ({
    identity: paneIdentity,
    pages: { source: 0, translated: 0 },
  }));
  const [metricsState, setMetricsState] = useState(() => ({ identity: paneIdentity, tick: 0 }));
  const numPagesByPane = pageState.identity === paneIdentity
    ? pageState.pages
    : { source: 0, translated: 0 };
  const metricsTick = metricsState.identity === paneIdentity ? metricsState.tick : 0;

  const flags = computeReaderPaneFlags({
    mode,
    sourceOnly,
    assetsReady,
    hasSource: Boolean(sourceFile) || Boolean(sourceUrl),
    hasTranslated: Boolean(translatedFile),
  });
  const { primaryPane } = flags;

  const onNumPages = useCallback((pages: number, pane: "source" | "translated") => {
    if (activeIdentityRef.current !== paneIdentity) return;
    setPageState((prev) => {
      const current = prev.identity === paneIdentity
        ? prev.pages
        : { source: 0, translated: 0 };
      if (current[pane] === pages && prev.identity === paneIdentity) return prev;
      return {
        identity: paneIdentity,
        pages: { ...current, [pane]: pages },
      };
    });
  }, [paneIdentity]);

  const metricsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMetrics = useCallback(() => {
    if (metricsTimerRef.current) clearTimeout(metricsTimerRef.current);
    const scheduledIdentity = paneIdentity;
    metricsTimerRef.current = setTimeout(() => {
      metricsTimerRef.current = null;
      if (activeIdentityRef.current !== scheduledIdentity) return;
      setMetricsState((prev) => ({
        identity: scheduledIdentity,
        tick: prev.identity === scheduledIdentity ? prev.tick + 1 : 1,
      }));
    }, 60);
  }, [paneIdentity]);

  useEffect(() => {
    if (metricsTimerRef.current) {
      clearTimeout(metricsTimerRef.current);
      metricsTimerRef.current = null;
    }
    setPageState((prev) => (
      prev.identity === paneIdentity && prev.pages.source === 0 && prev.pages.translated === 0
        ? prev
        : { identity: paneIdentity, pages: { source: 0, translated: 0 } }
    ));
    setMetricsState((prev) => (
      prev.identity === paneIdentity && prev.tick === 0
        ? prev
        : { identity: paneIdentity, tick: 0 }
    ));
    return () => {
      if (metricsTimerRef.current) {
        clearTimeout(metricsTimerRef.current);
        metricsTimerRef.current = null;
      }
    };
  }, [paneIdentity]);

  const hudNumPages = useMemo(
    () => Math.max(numPagesByPane.source, numPagesByPane.translated),
    [numPagesByPane],
  );

  const primaryNumPages = primaryPane === "translated"
    ? numPagesByPane.translated
    : numPagesByPane.source || numPagesByPane.translated;

  const userZoom = extras?.userZoom;
  const shellWidth = extras?.shellWidth;
  const rowSyncRevision = `${paneIdentity}-${metricsTick}-${userZoom}-${mode}-${numPagesByPane.source}-${numPagesByPane.translated}-${shellWidth}`;

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
