// 阅读页提问作为内置扩展（贡献表的第一个，2026-11-27）：宿主给了 ACP 端口才有。
// 登记右键「在这里提问 / 问这段」、书页白边上的「?」、顶栏右边的「提问」（不带出处地打开这本书的主对话：问整本书、翻以前的对话、开记忆）、底栏右边的「截图」、
// 快捷键说明（选着字按 ? 在 use-reader-ask 里自己监听）；提问窗是这个组件自己画的浮层。
import { useMemo, type ReactElement } from "react";
import { Crop, MessageCircleQuestion } from "lucide-react";

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
    editBlock: api.editBlock,
    jumpToBlock: api.jumpToBlock,
    pdfDocuments: api.pdfDocuments,
    currentPage: api.currentPage,
    visibleMode: api.visibleMode,
    activePanel: api.activePanel,
  });
  const { marks, onMark, menuItems, panel, overlay, cropping, toggleCrop, enabled, toggle, showing, reserveRight } = ask;
  const contribution = useMemo<ReaderContribution>(() => (enabled ? {
    toolbarItems: [{
      key: "ask",
      label: "提问",
      title: "提问：问整本书、翻这本书以前的对话（问某一段：书页上右键，或选字按 ?）",
      Icon: MessageCircleQuestion,
      pressed: showing,
      onClick: toggle,
    }, {
      // 底栏右边：框出书页上的一块，截图带进提问（和右键「截一块问」一样）。
      key: "crop",
      label: "截图",
      title: "截图：在书页上框出一块，带进提问（Esc 取消）",
      Icon: Crop,
      place: "bottom",
      pressed: cropping,
      onClick: toggleCrop,
    }],
    menuItems,
    pageLayer: marks.length
      ? ({ page, height }) => <ReaderAskMarks marks={marks} page={page} height={height} onOpen={onMark} />
      : undefined,
    shortcuts: SHORTCUTS,
    reserveRight,
    // 「截一块问」时占着书页上的指针：不出悬停框、不选字。
    takesPointer: cropping,
  } : {}), [enabled, menuItems, marks, onMark, toggle, showing, reserveRight, cropping, toggleCrop]);
  useReaderContribution(contribution);
  return <>{panel}{overlay}</>;
}

export const readerAskExtension: ReaderExtension = { id: "ask", title: "提问", Component: ReaderAskExtension };
