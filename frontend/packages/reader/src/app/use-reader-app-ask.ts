// 阅读页提问接到阅读页上：宿主给了 ACP 端口才有（从 ReaderAppReactPdf 拆出，2026-11-27；接线本身在 ask/use-reader-ask）。
import { useMemo } from "react";

import { useReaderAsk } from "../ask/use-reader-ask.js";
import { readerSessionDataPort } from "../external.js";
import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import type { PdfOutlineNode } from "../pdf/pdf-outline.js";
import type { RegionHoverStore } from "../shared/state/region-hover-store.js";

export function useReaderAppAsk(
  c: ReaderReactController,
  { bookmarks, regionHover, readingVersionId }: { bookmarks: readonly PdfOutlineNode[]; regionHover: RegionHoverStore; readingVersionId: string | null | undefined },
) {
  const { session, panes } = c;
  // 阅读页提问（docs/ops/planning/reader-ask/）：宿主给了 ACP 端口才有。右键「在这里提问 / 问这段」，书页上选着字时按 ? 也行；
  // 每本书一个主对话（2026-11-27），书页上的「?」是这本书上问过的地方（ask/use-reader-ask）。
  const askPort = useMemo(() => {
    try {
      return readerSessionDataPort().ask ?? null;
    } catch {
      return null;
    }
  }, []);
  return useReaderAsk({
    port: askPort,
    documentId: session.documentId || "",
    jobId: session.jobId,
    versionId: readingVersionId || null,
    regions: session.regions,
    metadata: session.readerMetadata,
    bookmarks,
    hoveredItemId: () => regionHover.get().itemId,
    resetKey: c.viewStateKey,
    goToPage: c.goToPage,
    pageCount: panes.hudNumPages || 0,
  });
}
