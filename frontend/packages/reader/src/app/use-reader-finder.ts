// 左栏（目录 / 搜索 / 书签 / 待处理）：开着哪一页签、钉没钉住、搜索词（防抖）、Cmd/Ctrl+F、点了跳（从 ReaderAppReactPdf 拆出，2026-11-27）。
//
// 两种摆法（2026-11-27）：默认浮在书页上（11-20 用户要的「目录最好是悬浮的」：点卡外、Esc、在目录里点一条都收起）；
// 栏头「钉住」以后是中间工作区横排里实占的一栏，点书、Esc 都不收。钉没钉、哪一页签记在本机；
// 打开阅读页时左栏总是收着（2026-11-28），展开时照记住的摆法。窄屏（< 900px）钉住也当浮着（让了书就没地方了）。
import { useCallback, useEffect, useState } from "react";

import type { ReaderFinderTab } from "../components/react-pdf/ReaderFinder.js";
import { useFindShortcut } from "../hooks/use-find-shortcut.js";
import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";

const MEMORY_KEY = "retainpdf.reader.sidebar.v1";
const TABS: readonly ReaderFinderTab[] = ["outline", "search", "bookmarks", "issues"];
/** 窄于这个宽度钉住也当浮着。 */
export const SIDEBAR_PIN_MIN_VIEWPORT = 900;

type SidebarMemory = { pinned: boolean; open: boolean; tab: ReaderFinderTab };

export function loadSidebarMemory(): SidebarMemory {
  try {
    const raw = JSON.parse(globalThis.localStorage?.getItem(MEMORY_KEY) || "{}");
    const tab = TABS.includes(raw?.tab) ? raw.tab : "outline";
    return { pinned: raw?.pinned === true, open: raw?.open === true, tab };
  } catch {
    return { pinned: false, open: false, tab: "outline" };
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
  // 开着哪一页签，null 收着。一进来总是收着（2026-11-28 用户：默认不占左边 300px，给书页留足宽度；点开关或 ⌘F 才展开）；
  // 钉没钉、上次看的哪一页签照旧记着，展开时用。
  const [finder, setFinderState] = useState<ReaderFinderTab | null>(null);
  const [lastTab, setLastTab] = useState<ReaderFinderTab>(memory.tab);
  const [pinnedChoice, setPinnedChoice] = useState(memory.pinned);
  const wide = useWideEnough();
  /** 真的钉在左边（钉住了、开着、屏够宽）：书页区让位、点书不收。 */
  const pinned = pinnedChoice && wide;
  const setFinder = useCallback((tab: ReaderFinderTab | null) => {
    setFinderState(tab);
    if (tab) setLastTab(tab);
  }, []);
  useEffect(() => {
    saveSidebarMemory({ pinned: pinnedChoice, open: Boolean(finder), tab: finder || lastTab });
  }, [pinnedChoice, finder, lastTab]);
  /** 顶栏左边那颗：收着就开上次那一页签，开着就收起。 */
  const toggleSidebar = useCallback(() => setFinderState((open) => (open ? null : lastTab)), [lastTab]);
  /** 点某一页签的开关（以前底栏的搜索）：开着的就是它就收起，不然切过去。 */
  const toggleFinder = useCallback((tab: ReaderFinderTab) => {
    setFinderState((open) => (open === tab ? null : tab));
    setLastTab(tab);
  }, []);
  const setPinned = useCallback((next: boolean) => setPinnedChoice(next), []);
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
  // 浮着时：在目录、书签里点一条跳过去就收起（卡盖着书）；搜索、待处理留着（接着按回车 / N 走下一处），窄屏上也收起。
  // 钉住时都不收。
  const closeAfterJump = useCallback(() => {
    if (pinned) return;
    if (finder === "outline" || finder === "bookmarks" || !wide) setFinderState(null);
  }, [pinned, finder, wide]);
  const jumpFromFinder = useCallback((itemId: string) => {
    c.jumpToAnchor({ block_id: itemId });
    closeAfterJump();
  }, [c.jumpToAnchor, closeAfterJump]);
  const jumpToPageFromFinder = useCallback((page: number) => {
    c.goToPage(page);
    closeAfterJump();
  }, [c.goToPage, closeAfterJump]);
  return {
    finder, setFinder, toggleFinder, toggleSidebar, pinned, pinnedChoice, setPinned, canPin: wide,
    findQuery, setFindQuery, findTerm, findFocus, jumpFromFinder, jumpToPageFromFinder,
  };
}

export type ReaderFinderState = ReturnType<typeof useReaderFinder>;
