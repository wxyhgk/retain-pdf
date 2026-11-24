// 阅读器键盘快捷键（输入框内、阅读辅助面板内不抢键）。
// 键位定义见 reader-keyboard-map.ts（实现与说明浮层共用同一份）。

import { useEffect } from "react";
import type { ReaderMode } from "./use-reader-session.js";
import {
  defaultZoomForMode,
  readerViewportWidth,
  stepReaderZoom,
} from "../pdf/reader-zoom.js";
import { clampPageNumber } from "../pdf/scroll-to-page.js";
import { matchReaderKeyBinding } from "./reader-keyboard-map.js";

export type ReaderKeyboardApi = {
  mode: ReaderMode;
  sourceOnly: boolean;
  setMode: (mode: ReaderMode) => void;
  userZoom: number;
  onZoomChange: (zoom: number) => void;
  currentPage: number;
  numPages: number;
  goToPage: (page: number) => void;
  /** 「深色文档」开关（D）；不给就不拦这个键。 */
  toggleDocDark?: () => void;
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

/** 焦点落在阅读辅助面板（Markdown / AI / 批注 / 终端…）里时，全局快捷键一律不处理。
 *
 * 所有 dock 面板都经 ReaderPanelShell 渲染，外壳类名是 `.reader-notes-panel`。
 * Markdown 的块是 tabIndex=0 的 div、AI 回答区是普通可滚动容器 —— 不在
 * isEditableTarget 的白名单里，原来 ↓ / PgDn / Home / End 被这里拦下去翻 PDF，
 * 面板自己反而滚不动。面板内的 Esc 关闭由 ReaderPanelShell 自己监听，不受影响；
 * 块上的 Enter / 空格（跳到对应页）由面板自己的监听处理。
 */
export const READER_PANEL_FOCUS_SELECTOR = ".reader-notes-panel";

export function isReaderPanelTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest(READER_PANEL_FOCUS_SELECTOR));
}

export function resolveReaderModeShortcut(
  key: string,
  sourceOnly: boolean,
): ReaderMode | null {
  const binding = matchReaderKeyBinding(key);
  if (!binding?.mode) return null;
  if (sourceOnly && binding.mode !== "source") return null;
  return binding.mode;
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
    toggleDocDark,
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
      if (isEditableTarget(event.target) || isReaderPanelTarget(event.target)) {
        return;
      }

      const key = event.key;
      const binding = matchReaderKeyBinding(key);
      if (!binding) {
        return;
      }

      // 模式：sourceOnly 下仅 source 可用；键位命中但被禁用时不拦截默认行为
      if (binding.mode) {
        if (sourceOnly && binding.mode !== "source") {
          return;
        }
        event.preventDefault();
        setMode(binding.mode);
        return;
      }

      if (binding.action === "doc-dark") {
        if (!toggleDocDark || event.repeat) return;
        event.preventDefault();
        toggleDocDark();
        return;
      }

      // 翻页：页数未知时不拦截
      if (binding.requiresPages && numPages <= 0) {
        return;
      }

      event.preventDefault();
      switch (binding.action) {
        case "zoom-in":
          onZoomChange(stepReaderZoom(userZoom, 1));
          return;
        case "zoom-out":
          onZoomChange(stepReaderZoom(userZoom, -1));
          return;
        case "zoom-reset":
          onZoomChange(defaultZoomForMode(mode, readerViewportWidth()));
          return;
        case "next-page":
          goToPage(clampPageNumber(currentPage + 1, numPages));
          return;
        case "prev-page":
          goToPage(clampPageNumber(currentPage - 1, numPages));
          return;
        case "first-page":
          goToPage(1);
          return;
        case "last-page":
          goToPage(numPages);
          return;
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
    toggleDocDark,
  ]);
}
