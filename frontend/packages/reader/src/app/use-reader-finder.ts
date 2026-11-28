// 左栏（搜索 / 书签 / 待改）：开着哪一页签、搜索词（防抖）、Cmd/Ctrl+F、点了跳（从 ReaderAppReactPdf 拆出，2026-11-27）。
//
// 2026-11-28 照原型 reader-prototype.html：目录挪去书页区左缘（ReaderTocMinimap），左栏只管「找」。
// 打开阅读页时总是收着，点顶栏「搜索」或 ⌘F 才展开；屏够宽（>= 900px）时是中间工作区横排里实占的一栏，
// 窄屏浮在书页上。以前（11-27）默认浮着、栏头图钉钉住才占一栏，原型里没有图钉，去掉了。上次看的哪一页签记在本机。
import { useCallback, useEffect, useState } from "react";

import type { ReaderFinderTab } from "../components/react-pdf/ReaderFinder.js";
import { useFindShortcut } from "../hooks/use-find-shortcut.js";
import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";

const MEMORY_KEY = "retainpdf.reader.sidebar.v1";
const TABS: readonly ReaderFinderTab[] = ["search", "bookmarks", "issues"];
/** 窄于这个宽度左栏浮在书页上（占一栏书页就没地方了）。 */
export const SIDEBAR_PIN_MIN_VIEWPORT = 900;

type SidebarMemory = { tab: ReaderFinderTab };

export function loadSidebarMemory(): SidebarMemory {
  try {
    const raw = JSON.parse(globalThis.localStorage?.getItem(MEMORY_KEY) || "{}");
    return { tab: TABS.includes(raw?.tab) ? raw.tab : "search" };
  } catch {
    return { tab: "search" };
  }
}

function saveSidebarMemory(memory: SidebarMemory): void {
  try {
    globalThis.localStorage?.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // 存不下就只在这次打开里有效。
  }
}

/** 视口够不够宽、能不能钉住（跟着窗口大小变）。 */
function useWideEnough(): boolean {
  const query = `(min-width: ${SIDEBAR_PIN_MIN_VIEWPORT}px)`;
  const [wide, setWide] = useState(() => (typeof window === "undefined" || !window.matchMedia ? true : window.matchMedia(query).matches));
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia(query);
    const onChange = () => setWide(media.matches);
    onChange();
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, [query]);
  return wide;
}

export function useReaderFinder(c: ReaderReactController) {
  const [memory] = useState(loadSidebarMemory);
  // 开着哪一页签，null 收着。一进来总是收着（2026-11-28 用户：默认不占左边，给书页留足宽度；点开关或 ⌘F 才展开）。
  const [finder, setFinderState] = useState<ReaderFinderTab | null>(null);
  const [lastTab, setLastTab] = useState<ReaderFinderTab>(memory.tab);
  const wide = useWideEnough();
  /** 实占一栏（屏够宽）：书页区让位、点书不收。 */
  const pinned = wide;
  const setFinder = useCallback((tab: ReaderFinderTab | null) => {
    setFinderState(tab);
    if (tab) setLastTab(tab);
  }, []);
  useEffect(() => {
    saveSidebarMemory({ tab: finder || lastTab });
  }, [finder, lastTab]);
  /** 顶栏左边那颗：收着就开上次那一页签，开着就收起。 */
  const toggleSidebar = useCallback(() => setFinderState((open) => (open ? null : lastTab)), [lastTab]);
  /** 点某一页签的开关（以前底栏的搜索）：开着的就是它就收起，不然切过去。 */
  const toggleFinder = useCallback((tab: ReaderFinderTab) => {
    setFinderState((open) => (open === tab ? null : tab));
    setLastTab(tab);
  }, []);
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
  }, [setFinder]);
  useFindShortcut(openFind);
  // 浮着时（窄屏，卡盖着书）点一条跳过去就收起；实占一栏时都不收（接着按回车 / N 走下一处）。
  const closeAfterJump = useCallback(() => {
    if (!pinned) setFinderState(null);
  }, [pinned]);
  const jumpFromFinder = useCallback((itemId: string) => {
    c.jumpToAnchor({ block_id: itemId });
    closeAfterJump();
  }, [c.jumpToAnchor, closeAfterJump]);
  const jumpToPageFromFinder = useCallback((page: number) => {
    c.goToPage(page);
    closeAfterJump();
  }, [c.goToPage, closeAfterJump]);
  return {
    finder, setFinder, toggleFinder, toggleSidebar, pinned,
    findQuery, setFindQuery, findTerm, findFocus, jumpFromFinder, jumpToPageFromFinder,
  };
}

export type ReaderFinderState = ReturnType<typeof useReaderFinder>;
