// 顶栏左边那颗和左栏（目录 / 搜索 / 书签 / 待处理，从 ReaderAppReactPdf 拆出，2026-11-27；状态在 use-reader-finder）。
// 待处理的 N / Shift+N 挂在这里（左栏收着也能用）。
import type { ReactElement } from "react";

import { ReaderFinder, ReaderFinderToggles } from "../components/react-pdf/ReaderFinder.js";
import { ReaderBookmarkList, ReaderIssueList } from "../components/react-pdf/ReaderSidebarLists.js";
import { useReaderContext, useReaderHudContext } from "../components/react-pdf/reader-context.js";
import { useReaderIssueNav } from "../hooks/use-reader-issues.js";
import type { PdfOutlineNode } from "../pdf/pdf-outline.js";
import type { ReaderFinderState } from "./use-reader-finder.js";

export function ReaderFinderArea({ state, bookmarks, bookmarkScope, issuesJobId }: {
  state: ReaderFinderState;
  bookmarks: PdfOutlineNode[];
  /** 书签按这本书存（和阅读位置同一个 scope）；空的就没有「书签」页签。 */
  bookmarkScope: string;
  /** 「待处理」读哪个任务的问题段落；空的就没有。 */
  issuesJobId: string;
}): ReactElement {
  const { finder, setFinder, toggleSidebar, findQuery, setFindQuery, findTerm, findFocus, jumpFromFinder, jumpToPageFromFinder, pinned, setPinned, canPin } = state;
  const ctx = useReaderContext();
  const hud = useReaderHudContext();
  const currentPage = hud?.currentPage ?? 1;
  const issues = useReaderIssueNav(issuesJobId, currentPage, ctx?.jumpToBlock);
  const issueCount = issues.issues.length;
  return (
    <>
      <ReaderFinderToggles open={finder} onToggle={toggleSidebar} issueCount={issueCount} />
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
          pinned={pinned}
          onPin={canPin ? setPinned : undefined}
          bookmarkPane={bookmarkScope ? (
            <ReaderBookmarkList
              scope={bookmarkScope}
              regions={ctx?.regions}
              currentPage={currentPage}
              numPages={hud?.numPages ?? 0}
              onJumpPage={jumpToPageFromFinder}
            />
          ) : undefined}
          issuesPane={issueCount ? <ReaderIssueList nav={issues} /> : undefined}
          issueCount={issueCount}
        />
      ) : null}
    </>
  );
}
