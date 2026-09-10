// 职责 4：reader mode 状态与 body class 同步（legacy CSS + chrome）。

import { useCallback, useEffect, useState } from "react";
import type { ReaderMode } from "./types.js";

/** Keep body `reader-mode-*` in sync (legacy CSS + chrome). */
export function applyBodyReaderMode(mode: ReaderMode): void {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare",
  );
  document.body.classList.add(`reader-mode-${mode}`);
}

/**
 * 会话内部的无条件 mode 窄命令：同时写 state 与 body class。
 * 与 UI 入口 setMode（受 sourceViewOnly 约束）不同，会话解析/回退需要
 * 绕过该约束，因此各模块统一走这里，不再分别调用 setModeState + applyBodyReaderMode。
 */
export function applySessionMode(
  setModeState: React.Dispatch<React.SetStateAction<ReaderMode>>,
  mode: ReaderMode,
): void {
  setModeState(mode);
  applyBodyReaderMode(mode);
}

export function useReaderMode(sourceViewOnly: boolean): {
  mode: ReaderMode;
  setMode: (mode: ReaderMode) => void;
  setModeState: React.Dispatch<React.SetStateAction<ReaderMode>>;
  /** 窄命令：会话编排层切换 mode 的唯一入口（无条件，不受 sourceViewOnly 约束）。 */
  switchSessionMode: (mode: ReaderMode) => void;
} {
  const [mode, setModeState] = useState<ReaderMode>(sourceViewOnly ? "source" : "compare");

  const setMode = useCallback((next: ReaderMode) => {
    if (sourceViewOnly && next !== "source") {
      return;
    }
    setModeState(next);
    applyBodyReaderMode(next);
  }, [sourceViewOnly]);

  const switchSessionMode = useCallback((next: ReaderMode) => {
    applySessionMode(setModeState, next);
  }, []);

  useEffect(() => {
    if (sourceViewOnly) {
      document.documentElement.classList.add("reader-source-only");
    }
    applyBodyReaderMode(mode);
    return () => {
      document.documentElement.classList.remove("reader-source-only");
    };
  }, [sourceViewOnly, mode]);

  return { mode, setMode, setModeState, switchSessionMode };
}
