// 详情 Tab 单源：点击书籍卡统一落到 overview，只有显式处理入口才进入 processing。
// - prefer_translate_tab 仅表达调用方明确的处理意图，不再从任务状态或可阅读性推断
// - 仅在 open 变化时置位（不监听 documentId/payload 持续变化，避免竞态）
// - defaultTab 纯派生 useMemo，不设 state
// - 暴露 setPreferTranslateTab/markTranslateStarted 供 handleTranslate 复用（与原 onTranslateStarted 双写合并为单源）

import { useEffect, useMemo, useState, useCallback } from "react";

export type UseBookDetailTabOptions = {
  open: boolean;
  payloadItem?: any;
  item?: any;
  readerAvailable?: boolean;
  isActive?: boolean;
};

export function useBookDetailTab({
  open,
  payloadItem,
}: UseBookDetailTabOptions) {
  const [preferTranslateTab, setPreferTranslateTab] = useState(false);

  // 仅在 open 变化时置位
  useEffect(() => {
    setPreferTranslateTab(Boolean(open && payloadItem?.prefer_translate_tab));
  }, [open]);

  const markTranslateStarted = useCallback(() => {
    setPreferTranslateTab(true);
  }, []);

  const explicitProcessingEntry = Boolean(open && payloadItem?.prefer_translate_tab);
  const defaultTab = useMemo(
    () => (preferTranslateTab || explicitProcessingEntry ? "processing" : "overview"),
    [explicitProcessingEntry, preferTranslateTab],
  );

  return {
    preferTranslateTab,
    setPreferTranslateTab,
    markTranslateStarted,
    defaultTab,
  };
}
