// 改译文：悬停框里的「改」、按 E，以及书页上「改过几次」的角标（从 ReaderAppReactPdf 拆出，2026-11-27）。
import { useCallback, useMemo } from "react";

import { useEditBlockShortcut, useReaderBlockEdit } from "../hooks/use-reader-block-edit.js";
import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import { isEditableReaderBlock } from "../shared/data/block-edit.js";
import type { RegionHoverStore } from "../shared/state/region-hover-store.js";
import type { ReaderPaneComposition } from "./pane-composition.js";

export function useReaderBlockEditing(c: ReaderReactController, visiblePdfMode: ReaderPaneComposition["visibleMode"], regionHover: RegionHoverStore) {
  const { session, sessionFiles } = c;
  // 改译文：悬停框里的「改」、按 E 都是把这一段变成编辑框（在译文栏里）。只开着原文栏时先切到对照。
  const blockEdit = useReaderBlockEdit({
    jobId: session.jobId,
    jobStatus: session.jobStatus,
    jobPayload: session.download.jobPayload,
    hasTranslation: !c.sourceOnly && Boolean(sessionFiles.translatedUrl),
    refreshJobStatus: session.refreshJobStatus,
  });
  const selectBlock = blockEdit.select;
  const setModeKeepingPage = c.setModeKeepingPage;
  const regions = session.regions;
  const editBlock = useCallback((itemId: string) => {
    if (!isEditableReaderBlock(regions, itemId)) return; // 表格译文还不能改（block-edit 的 EDITABLE_KINDS）
    if (visiblePdfMode === "source") setModeKeepingPage("compare");
    selectBlock(itemId);
  }, [regions, selectBlock, visiblePdfMode, setModeKeepingPage]);
  useEditBlockShortcut(blockEdit.available ? editBlock : null, regionHover);
  const revisedBlocks = useMemo(() => {
    if (!blockEdit.savedCounts.size) return c.revisedBlocks;
    const merged = new Map(c.revisedBlocks);
    for (const [itemId, count] of blockEdit.savedCounts) merged.set(itemId, (merged.get(itemId) || 0) + count);
    return merged;
  }, [c.revisedBlocks, blockEdit.savedCounts]);
  return { blockEdit, editBlock, revisedBlocks };
}
