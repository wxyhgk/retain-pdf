// 阅读页这一侧的贡献表接线（2026-11-27 从 ReaderAppReactPdf 拆出）：给扩展看的阅读页接口（useReaderApi），
// 阅读页自己建的那张表，以及从表里收拢出来、阅读页各处要用的东西。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ReaderAssistantPanel } from "../components/react-pdf/index.js";
import {
  collectMenuSections,
  collectReserveRight,
  collectPageLayers,
  collectTextMarks,
  createContributionStore,
  pickComparedDocument,
  pointerTakenBy,
  useReaderContributionsOf,
} from "../extensions/registry.js";
import type { ReaderApi } from "../extensions/types.js";
import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import type { ReaderTranslationVersions } from "../hooks/use-reader-version-compare.js";
import type { PdfOutlineNode } from "../pdf/pdf-outline.js";
import type { RegionHoverStore } from "../shared/state/region-hover-store.js";

/** 扩展登记的那张表，以及阅读页排版要先知道的一项（扩展的浮层贴右边让出多宽）。
 * 单独一个 hook：书页区的宽度、对照放不放得下要在排台面之前算，而给扩展看的接口（下面）要用排好的台面。 */
export function useReaderContributionTable() {
  const [contributionStore] = useState(createContributionStore);
  const contributions = useReaderContributionsOf(contributionStore);
  // 扩展的浮层贴在右边（提问窗贴右边）：书页让出的宽度。
  const reserveRight = collectReserveRight(contributions);
  return { contributionStore, contributions, reserveRight };
}

export type ReaderContributionTable = ReturnType<typeof useReaderContributionTable>;

/** 右边只停一个：扩展的浮层刚贴到右边时，关掉停着的面板（Markdown）；面板刚打开时，扩展从 activePanel 看到、自己挪开
 * （提问窗变回浮动，见 use-reader-ask 的 dockTaken）。两头都只看「刚变」的那一下，后来的那个留下。 */
export function useRightDockSlot(reserveRight: number, assistantPanel: unknown, closeAssistant: () => void) {
  const before = useRef(reserveRight);
  useEffect(() => {
    const arrived = reserveRight > 0 && before.current <= 0;
    before.current = reserveRight;
    if (arrived && assistantPanel) closeAssistant();
  }, [reserveRight]);
}

export function useReaderExtensionHost(
  c: ReaderReactController,
  table: ReaderContributionTable,
  {
    translationVersions,
    bookmarks,
    regionHover,
    assistantPanel,
    closeAssistant,
    visiblePdfMode,
    changeWorkspace,
    jumpToBlockIn,
    zoomDocuments,
    editBlock,
    panelHost = null,
  }: {
    translationVersions: ReaderTranslationVersions;
    bookmarks: readonly PdfOutlineNode[];
    regionHover: RegionHoverStore;
    assistantPanel: ReaderAssistantPanel | null;
    closeAssistant: () => void;
    visiblePdfMode: ReaderApi["visibleMode"];
    changeWorkspace: ReaderApi["setWorkspace"];
    jumpToBlockIn: ReaderApi["jumpToBlock"];
    zoomDocuments: ReaderApi["pdfDocuments"];
    editBlock: ReaderApi["editBlock"];
    panelHost?: HTMLElement | null;
  },
) {
  const { session, panes } = c;
  const pageNow = useRef(c.currentPage);
  pageNow.current = c.currentPage;
  const currentPage = useCallback(() => pageNow.current, []);
  const readerApi = useMemo<ReaderApi>(() => ({
    documentId: session.documentId || "",
    jobId: session.jobId,
    versionId: translationVersions.readingVersionId || null,
    translationVersions: translationVersions.versions,
    regions: session.regions,
    metadata: session.readerMetadata,
    bookmarks,
    pageCount: panes.hudNumPages || 0,
    resetKey: c.viewStateKey,
    hoveredItemId: () => regionHover.get().itemId,
    goToPage: c.goToPage,
    sourceOnly: c.sourceOnly,
    activePanel: assistantPanel,
    closePanel: closeAssistant,
    panelHost,
    visibleMode: visiblePdfMode,
    setWorkspace: changeWorkspace,
    jumpToBlock: jumpToBlockIn,
    shellEl: c.shell.shellEl,
    primaryPane: c.panes.primaryPane,
    pdfDocuments: zoomDocuments,
    editBlock,
    currentPage,
  }), [
    session.documentId, session.jobId, translationVersions, session.regions, session.readerMetadata, bookmarks, panes.hudNumPages,
    c.viewStateKey, regionHover, c.goToPage, c.sourceOnly, assistantPanel, closeAssistant, visiblePdfMode, changeWorkspace,
    jumpToBlockIn, c.shell.shellEl, c.panes.primaryPane, zoomDocuments, editBlock, panelHost,
  ]);
  const { contributionStore, contributions, reserveRight } = table;
  const pageLayers = useMemo(() => collectPageLayers(contributions), [contributions]);
  // 对照时左栏换成的那一份（对比版本扩展给的）。
  const compareVersion = useMemo(() => pickComparedDocument(contributions), [contributions]);
  // 扩展给的文字层标记（交叉引用……）。
  const textMarks = useMemo(() => collectTextMarks(contributions), [contributions]);
  const menuSections = useMemo(() => collectMenuSections(contributions), [contributions]);
  // 有扩展占着书页上的指针（画笔模式）：书页不出悬停框，根节点带 data-pointer-taken（文字层不让拖选）。
  const pointerTakenId = pointerTakenBy(contributions);
  return { readerApi, contributionStore, contributions, pageLayers, compareVersion, textMarks, menuSections, pointerTakenId, reserveRight };
}
