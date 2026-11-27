// 左上角目录 / 搜索两个开关和开着的那张卡（从 ReaderAppReactPdf 拆出，2026-11-27；状态在 use-reader-finder）。
import type { ReactElement } from "react";

import { ReaderFinder, ReaderFinderToggles } from "../components/react-pdf/ReaderFinder.js";
import type { PdfOutlineNode } from "../pdf/pdf-outline.js";
import type { ReaderFinderState } from "./use-reader-finder.js";

export function ReaderFinderArea({ state, bookmarks }: { state: ReaderFinderState; bookmarks: PdfOutlineNode[] }): ReactElement {
  const { finder, setFinder, toggleFinder, findQuery, setFindQuery, findTerm, findFocus, jumpFromFinder, jumpToPageFromFinder } = state;
  return (
    <>
      <ReaderFinderToggles open={finder} onToggle={toggleFinder} />
      {finder ? (
        <ReaderFinder
          tab={finder}
          onTab={setFinder}
          onClose={() => setFinder(null)}
          onJump={jumpFromFinder}
          bookmarks={bookmarks}
          onJumpPage={jumpToPageFromFinder}
          query={findQuery}
          onQuery={setFindQuery}
          term={findTerm}
          focusSignal={findFocus}
        />
      ) : null}
    </>
  );
}
