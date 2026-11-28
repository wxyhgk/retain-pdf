// 阅读模式（原文 / 对照 / 译文）按书恢复和存档（从 ReaderAppReactPdf 拆出，2026-11-27）。
import { useEffect, useRef } from "react";

import { resolveReaderInitialMode, shouldPersistReaderMode } from "../hooks/reader-initial-mode.js";
import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import type { ReaderMode } from "../hooks/use-reader-session.js";
import { readerViewportWidth } from "../pdf/reader-zoom.js";
import { loadReaderViewState, saveReaderViewState } from "../shared/state/reader-view-state.js";

export function useReaderModePersistence(c: ReaderReactController, sourceViewOnly: boolean): void {
  const { boot } = c;
  const modeScopeRef = useRef<string | null>(null);
  const autoModeRef = useRef<ReaderMode | null>(null);
  // 阅读模式恢复/持久化：与 anchor/zoom 对齐。sourceViewOnly 时只允许 source。
  // 窄屏没有存档时自动进译文（resolveReaderInitialMode）；停在这个自动默认上时
  // 不写存档，用户换过模式之后照常写（shouldPersistReaderMode）。
  useEffect(() => {
    if (boot.loading || boot.failed) return;
    if (modeScopeRef.current !== c.viewStateKey) {
      modeScopeRef.current = c.viewStateKey;
      const saved = loadReaderViewState(c.viewStateKey);
      const initial = resolveReaderInitialMode({
        savedMode: saved?.mode,
        sourceViewOnly,
        viewportWidth: readerViewportWidth(),
      });
      autoModeRef.current = initial.auto ? initial.mode : null;
      if (initial.mode && initial.mode !== c.mode) {
        c.setModeKeepingPage(initial.mode);
      }
      return;
    }
    if (!shouldPersistReaderMode(c.mode, autoModeRef.current)) return;
    autoModeRef.current = null;
    saveReaderViewState(c.viewStateKey, { mode: c.mode });
  }, [boot.failed, boot.loading, c.mode, c.setModeKeepingPage, c.viewStateKey, sourceViewOnly]);
}
