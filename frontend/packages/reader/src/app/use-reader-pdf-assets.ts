// 各栏读好的 PDF 带出来的东西：自带书签（目录卡用）、PDF 对象（放大查看用）和开着放大的那一块（从 ReaderAppReactPdf 拆出，2026-11-27）。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import type { PdfOutlineNode } from "../pdf/pdf-outline.js";
import type { RegionPdfDocument } from "../pdf/RegionCanvas.js";

/** 稳定的空书签列表（每次新建一个会让目录卡白白重算）。 */
const NO_BOOKMARKS: PdfOutlineNode[] = [];

export function useReaderPdfAssets(c: ReaderReactController) {
  const { sessionFiles } = c;
  // PDF 自带的书签（目录卡优先用它）：按栏记，带上是哪个文件的，换书、换文件就作废。原文的优先（译文 PDF 多半没有书签）。
  const [pdfOutlines, setPdfOutlines] = useState<Partial<Record<"source" | "translated", { url: string; nodes: PdfOutlineNode[] }>>>({});
  const outlineUrls = useRef({ source: sessionFiles.sourceUrl, translated: sessionFiles.translatedUrl });
  outlineUrls.current = { source: sessionFiles.sourceUrl, translated: sessionFiles.translatedUrl };
  const onPdfOutline = useCallback((nodes: PdfOutlineNode[], pane: "source" | "translated") => {
    setPdfOutlines((current) => ({ ...current, [pane]: { url: outlineUrls.current[pane], nodes } }));
  }, []);
  const bookmarks = useMemo(() => {
    const source = pdfOutlines.source;
    if (source && source.url === sessionFiles.sourceUrl && source.nodes.length) return source.nodes;
    const translated = pdfOutlines.translated;
    if (translated && translated.url === sessionFiles.translatedUrl && translated.nodes.length) return translated.nodes;
    return NO_BOOKMARKS;
  }, [pdfOutlines, sessionFiles.sourceUrl, sessionFiles.translatedUrl]);
  // 放大查看：各栏读好的 PDF（按文件记，换文件作废）和开着的那一块。
  const pdfDocs = useRef<Partial<Record<"source" | "translated", { url: string; pdf: RegionPdfDocument }>>>({});
  const [pdfDocsVersion, setPdfDocsVersion] = useState(0);
  const onPdfDocument = useCallback((pdf: RegionPdfDocument, pane: "source" | "translated") => {
    pdfDocs.current[pane] = { url: outlineUrls.current[pane], pdf };
    setPdfDocsVersion((version) => version + 1);
  }, []);
  const [zoomItem, setZoomItem] = useState<string | null>(null);
  const zoomBlock = useCallback((itemId: string) => setZoomItem(itemId), []);
  const closeZoom = useCallback(() => setZoomItem(null), []);
  useEffect(() => setZoomItem(null), [c.viewStateKey]);
  const zoomDocuments = useMemo(() => {
    const pick = (pane: "source" | "translated", url: string) => {
      const entry = pdfDocs.current[pane];
      return entry && entry.url === url ? entry.pdf : null;
    };
    return { source: pick("source", sessionFiles.sourceUrl), translated: pick("translated", sessionFiles.translatedUrl) };
  }, [pdfDocsVersion, sessionFiles.sourceUrl, sessionFiles.translatedUrl]);
  return { bookmarks, onPdfOutline, onPdfDocument, zoomItem, setZoomItem, zoomBlock, closeZoom, zoomDocuments };
}
