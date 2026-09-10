import { useCallback, useRef } from "react";
import type { ReaderMode } from "./use-reader-session.js";

export type ModeNavigationApi = {
  setModeKeepingPage: (next: ReaderMode) => void;
};

/**
 * Mode switch that freezes/restores reading anchor via beginModeSwitch.
 * Keeps a stable callback by reading latest mode/setMode/beginModeSwitch from refs.
 */
export function useReaderModeNavigation(options: {
  mode: ReaderMode;
  setMode: (mode: ReaderMode) => void;
  beginModeSwitch: () => void;
}): ModeNavigationApi {
  const { mode, setMode, beginModeSwitch } = options;

  const modeRef = useRef(mode);
  const setModeRef = useRef(setMode);
  const beginModeSwitchRef = useRef(beginModeSwitch);
  modeRef.current = mode;
  setModeRef.current = setMode;
  beginModeSwitchRef.current = beginModeSwitch;

  const setModeKeepingPage = useCallback((next: ReaderMode) => {
    if (next === modeRef.current) {
      return;
    }
    beginModeSwitchRef.current();
    setModeRef.current(next);
  }, []);

  return { setModeKeepingPage };
}
