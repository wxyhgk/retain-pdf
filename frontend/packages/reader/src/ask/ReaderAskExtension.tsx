// 阅读页提问作为内置扩展（贡献表的第一个，2026-11-27）：宿主给了 ACP 端口才有。
// 登记右键「在这里提问 / 问这段」、书页白边上的「?」、快捷键说明（选着字按 ? 在 use-reader-ask 里自己监听）；提问窗是这个组件自己画的浮层。
import { useMemo, type ReactElement } from "react";

import { readerSessionDataPort } from "../external.js";
import { useReaderApi, useReaderContribution } from "../extensions/registry.js";
import type { ReaderContribution, ReaderExtension } from "../extensions/types.js";
import { ReaderAskMarks } from "./ReaderAskMarks.js";
import { useReaderAsk } from "./use-reader-ask.js";

const SHORTCUTS = [{ keys: "选字 + ?", desc: "问选中的这段" }] as const;

function ReaderAskExtension(): ReactElement | null {
  const api = useReaderApi();
  const port = useMemo(() => {
    try {
      return readerSessionDataPort().ask ?? null;
    } catch {
      return null;
    }
  }, []);
  const ask = useReaderAsk({
    port,
    documentId: api.documentId,
    jobId: api.jobId,
    versionId: api.versionId,
    regions: api.regions,
    metadata: api.metadata,
    bookmarks: api.bookmarks,
    hoveredItemId: api.hoveredItemId,
    resetKey: api.resetKey,
    goToPage: api.goToPage,
    pageCount: api.pageCount,
  });
  const { marks, onMark, menuItems, panel, enabled } = ask;
  const contribution = useMemo<ReaderContribution>(() => (enabled ? {
    menuItems,
    pageLayer: marks.length
      ? ({ page, height }) => <ReaderAskMarks marks={marks} page={page} height={height} onOpen={onMark} />
      : undefined,
    shortcuts: SHORTCUTS,
  } : {}), [enabled, menuItems, marks, onMark]);
  useReaderContribution(contribution);
  return panel;
}

export const readerAskExtension: ReaderExtension = { id: "ask", title: "提问", Component: ReaderAskExtension };
