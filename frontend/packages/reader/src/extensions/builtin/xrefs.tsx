// 书里的引用（「图 2.1」「式 (3.21)」）作为内置扩展（2026-11-27）：文字层里标出来（textMarks），悬停一会儿浮出预览，点了跳过去；
// Alt+← 回到跳之前读到的地方，Alt+→ 再跳回去（hooks/use-reader-xrefs 在书页外壳上接事件）。预览和「回到第 N 页」是这个组件自己画的。
import { useCallback, useMemo, type ReactElement } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@retainpdf/ui";

import { ReaderXrefPreview } from "../../components/react-pdf/ReaderXrefPreview.js";
import { useReaderXrefs } from "../../hooks/use-reader-xrefs.js";
import type { ReaderPaneId } from "../../pdf/reader-dom-contract.js";
import { buildXrefIndex, xrefTextMarks, type XrefTarget } from "../../shared/content/reader-xrefs.js";
import { useReaderApi, useReaderContribution } from "../registry.js";
import type { ReaderContribution, ReaderExtension } from "../types.js";

const SHORTCUTS = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" },
] as const;

function XrefsExtension(): ReactElement {
  const api = useReaderApi();
  const index = useMemo(() => buildXrefIndex(api.regions), [api.regions]);
  const { jumpToBlock } = api;
  const follow = useCallback((target: XrefTarget, pane: ReaderPaneId) => jumpToBlock(target.itemId, pane), [jumpToBlock]);
  const xrefs = useReaderXrefs({ shellEl: api.shellEl, index, primaryPane: api.primaryPane, follow });
  const contribution = useMemo<ReaderContribution>(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: index.size ? (text) => xrefTextMarks(text, index) : undefined,
    shortcuts: SHORTCUTS,
  }), [index]);
  useReaderContribution(contribution);
  return (
    <>
      {xrefs.preview ? (
        <ReaderXrefPreview preview={xrefs.preview} regions={api.regions} metadata={api.metadata} documents={api.pdfDocuments} />
      ) : null}
      {xrefs.canGoBack ? (
        <Button className="reader-xref-back" title="回到跳之前读到的地方（Alt+←）" onClick={() => xrefs.goBack()}>
          <ArrowLeft size={14} aria-hidden /> 回到第 {xrefs.backPage} 页
        </Button>
      ) : null}
    </>
  );
}

export const readerXrefsExtension: ReaderExtension = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: XrefsExtension };
