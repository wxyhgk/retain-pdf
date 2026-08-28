// Phím tắt reader (không chiếm phím trong input).
// j/↓/PageDown trang sau · k/↑/PageUp trang trước · Home/End đầu/cuối tài liệu
// +/- zoom · 0 reset zoom mặc định theo mode · 1/2/3 gốc/bản dịch/đối chiếu

import { useEffect } from "react";
import type { ReaderMode } from "./use-reader-session.js";
import {
  defaultZoomForMode,
  stepReaderZoom,
} from "../pdf/reader-zoom.js";
import { clampPageNumber } from "../pdf/scroll-to-page.js";

export type ReaderKeyboardApi = {
  mode: ReaderMode;
  sourceOnly: boolean;
  setMode: (mode: ReaderMode) => void;
  userZoom: number;
  onZoomChange: (zoom: number) => void;
  currentPage: number;
  numPages: number;
  goToPage: (page: number) => void;
  enabled?: boolean;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function useReaderKeyboard(api: ReaderKeyboardApi) {
  const {
    mode,
    sourceOnly,
    setMode,
    userZoom,
    onZoomChange,
    currentPage,
    numPages,
    goToPage,
    enabled = true,
  } = api;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }

      const key = event.key;
      const lower = key.length === 1 ? key.toLowerCase() : key;

      // Mode
      if (lower === "1") {
        event.preventDefault();
        setMode("source");
        return;
      }
      if (lower === "2" && !sourceOnly) {
        event.preventDefault();
        setMode("translated");
        return;
      }
      if (lower === "3" && !sourceOnly) {
        event.preventDefault();
        setMode("compare");
        return;
      }

      // Zoom
      if (key === "+" || key === "=") {
        event.preventDefault();
        onZoomChange(stepReaderZoom(userZoom, 1));
        return;
      }
      if (key === "-" || key === "_") {
        event.preventDefault();
        onZoomChange(stepReaderZoom(userZoom, -1));
        return;
      }
      if (lower === "0") {
        event.preventDefault();
        onZoomChange(defaultZoomForMode(mode));
        return;
      }

      // Chuyển trang
      if (numPages <= 0) {
        return;
      }
      if (lower === "j" || key === "ArrowDown" || key === "PageDown") {
        event.preventDefault();
        goToPage(clampPageNumber(currentPage + 1, numPages));
        return;
      }
      if (lower === "k" || key === "ArrowUp" || key === "PageUp") {
        event.preventDefault();
        goToPage(clampPageNumber(currentPage - 1, numPages));
        return;
      }
      if (key === "Home") {
        event.preventDefault();
        goToPage(1);
        return;
      }
      if (key === "End") {
        event.preventDefault();
        goToPage(numPages);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    enabled,
    mode,
    sourceOnly,
    setMode,
    userZoom,
    onZoomChange,
    currentPage,
    numPages,
    goToPage,
  ]);
}
