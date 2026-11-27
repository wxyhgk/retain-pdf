// 左边的目录 / 书内搜索：开着哪一页签、搜索词（防抖）、Cmd/Ctrl+F、点了跳（从 ReaderAppReactPdf 拆出，2026-11-27）。
import { useCallback, useEffect, useState } from "react";

import type { ReaderFinderTab } from "../components/react-pdf/ReaderFinder.js";
import { useFindShortcut } from "../hooks/use-find-shortcut.js";
import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import { readerViewportWidth } from "../pdf/reader-zoom.js";

export function useReaderFinder(c: ReaderReactController) {
  // 左栏的目录 / 搜索：开着哪一页签，null 收着。
  const [finder, setFinder] = useState<ReaderFinderTab | null>(null);
  const toggleFinder = useCallback((tab: ReaderFinderTab) => setFinder((open) => (open === tab ? null : tab)), []);
  // 搜索词：输入框里的字和防抖后的词。防抖后的词才去扫全书、标书页——每敲一下就扫，几百页的书会卡。
  // 收起左栏不清词，再打开还在；收起时书页上不标。
  const [findQuery, setFindQuery] = useState("");
  const [findTerm, setFindTerm] = useState("");
  useEffect(() => {
    const next = findQuery.replace(/\s+/gu, " ").trim();
    const timer = window.setTimeout(() => setFindTerm(next), next ? 150 : 0);
    return () => window.clearTimeout(timer);
  }, [findQuery]);
  const [findFocus, setFindFocus] = useState(0);
  // Cmd/Ctrl+F 打开书内搜索（再按一次交还浏览器，见 use-find-shortcut）。
  const openFind = useCallback(() => {
    setFinder("search");
    setFindFocus((count) => count + 1);
  }, []);
  useFindShortcut(openFind);
  const jumpFromFinder = useCallback((itemId: string) => {
    c.jumpToAnchor({ block_id: itemId });
    // 卡浮在书上：在目录里点一条就收起；搜索时留着（接着按回车走下一处），窄屏上搜索也收起（卡盖着书）。
    if (finder === "outline" || readerViewportWidth() < 900) setFinder(null);
  }, [c.jumpToAnchor, finder]);
  const jumpToPageFromFinder = useCallback((page: number) => {
    c.goToPage(page);
    if (finder === "outline" || readerViewportWidth() < 900) setFinder(null);
  }, [c.goToPage, finder]);
  return { finder, setFinder, toggleFinder, findQuery, setFindQuery, findTerm, findFocus, jumpFromFinder, jumpToPageFromFinder };
}

export type ReaderFinderState = ReturnType<typeof useReaderFinder>;
