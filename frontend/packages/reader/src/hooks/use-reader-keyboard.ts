// 阅读器键盘快捷键（输入框内不抢键）。
// j/↓/PageDown 下页 · k/↑/PageUp 上页 · Home/End 首末页
// +/- 缩放 · 0 重置模式默认缩放 · 1/2/3 源文件/对照/翻译文件

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

export function resolveReaderModeShortcut(
  key: string,
  sourceOnly: boolean,
): ReaderMode | null {
  if (key === "1") return "source";
  if (sourceOnly) return null;
  if (key === "2") return "compare";
  if (key === "3") return "translated";
  return null;
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

      // 模式
      const shortcutMode = resolveReaderModeShortcut(lower, sourceOnly);
      if (shortcutMode) {
        event.preventDefault();
        setMode(shortcutMode);
        return;
      }

      // 缩放
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

      // 翻页
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
