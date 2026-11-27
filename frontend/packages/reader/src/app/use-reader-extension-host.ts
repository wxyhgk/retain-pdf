// 阅读页这一侧的贡献表接线（2026-11-27 从 ReaderAppReactPdf 拆出）：给扩展看的阅读页接口（useReaderApi），
// 阅读页自己建的那张表，以及从表里收拢出来、阅读页各处要用的东西。
import { useMemo, useState } from "react";

import type { ReaderAssistantPanel } from "../components/react-pdf/index.js";
import {
  collectMenuSections,
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

export function useReaderExtensionHost(
  c: ReaderReactController,
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
  },
) {
  const { session, panes } = c;
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
    visibleMode: visiblePdfMode,
    setWorkspace: changeWorkspace,
    jumpToBlock: jumpToBlockIn,
    shellEl: c.shell.shellEl,
    primaryPane: c.panes.primaryPane,
    pdfDocuments: zoomDocuments,
  }), [
    session.documentId, session.jobId, translationVersions, session.regions, session.readerMetadata, bookmarks, panes.hudNumPages,
    c.viewStateKey, regionHover, c.goToPage, c.sourceOnly, assistantPanel, closeAssistant, visiblePdfMode, changeWorkspace,
    jumpToBlockIn, c.shell.shellEl, c.panes.primaryPane, zoomDocuments,
  ]);
  const [contributionStore] = useState(createContributionStore);
  const contributions = useReaderContributionsOf(contributionStore);
  const pageLayers = useMemo(() => collectPageLayers(contributions), [contributions]);
  // 对照时左栏换成的那一份（对比版本扩展给的）。
  const compareVersion = useMemo(() => pickComparedDocument(contributions), [contributions]);
  // 扩展给的文字层标记（交叉引用……）。
  const textMarks = useMemo(() => collectTextMarks(contributions), [contributions]);
  const menuSections = useMemo(() => collectMenuSections(contributions), [contributions]);
  // 有扩展占着书页上的指针（画笔模式）：书页不出悬停框，根节点带 data-pointer-taken（文字层不让拖选）。
  const pointerTakenId = pointerTakenBy(contributions);
  return { readerApi, contributionStore, contributions, pageLayers, compareVersion, textMarks, menuSections, pointerTakenId };
}
