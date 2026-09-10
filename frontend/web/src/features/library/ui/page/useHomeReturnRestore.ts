// 从阅读器返回主页后：恢复 tab 滚动位置。
// - bfcache（pageshow.persisted）：DOM 完好，清掉 pending 即可
// - 普通 reload：列表有数据后再 apply scroll（避免高度为 0 时写 scrollTop 无效）

import { useEffect, useRef } from "react";
import {
  applyHomeReturnScroll,
  clearHomeReturnState,
  consumeHomeReturnState,
  peekHomeReturnState,
  type HomeReturnState,
} from "@/platform/navigation/home-return-state.js";
import { parseHomeTab, toUiTabKey } from "@/platform/navigation/pages.js";

export function readInitialLibraryTabFromReturn(): string {
  // 统一契约 home ?tab=library|collections|favorites|ask 优先（collections == UI 键 categories）。
  const fromQuery = parseHomeTab();
  if (fromQuery) {
    return toUiTabKey(fromQuery);
  }
  const state = peekHomeReturnState();
  const tab = `${state?.activeTab || ""}`;
  if (
    tab === "categories" // == collections（历史契约，见 LibraryTopTabs COLLECTIONS_TAB_KEY）
    || tab === "favorites"
    || tab === "library"
    || tab === "ask"
  ) {
    return tab;
  }
  return "library";
}

/**
 * @param ready 图书馆列表已有内容（或合集/收藏视图已挂载）时再恢复滚动
 */
export function useHomeReturnRestore(ready: boolean) {
  const restoredRef = useRef(false);

  // bfcache：整页从缓存唤起，滚动本来就在，丢掉 pending 避免二次跳动
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        clearHomeReturnState();
        restoredRef.current = true;
      }
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    if (!ready || restoredRef.current) return;

    let state: HomeReturnState | null = peekHomeReturnState();
    if (!state) {
      restoredRef.current = true;
      return;
    }
    // 无有效滚动也清掉，避免脏数据
    if (
      state.libraryScrollTop <= 0
      && state.panelScrollTop <= 0
      && state.windowScrollY <= 0
    ) {
      clearHomeReturnState();
      restoredRef.current = true;
      return;
    }

    restoredRef.current = true;
    state = consumeHomeReturnState();
    if (!state) return;

    // 双 rAF：等布局 / 图片占位后再设 scrollTop
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyHomeReturnScroll(state!);
        // 列表异步增高时再补一次
        window.setTimeout(() => applyHomeReturnScroll(state!), 80);
        window.setTimeout(() => applyHomeReturnScroll(state!), 320);
      });
    });
  }, [ready]);
}
