// 左栏（搜索 / 书签 / 待改；目录 2026-11-28 挪去书页区左缘的 ReaderTocMinimap，从 ReaderAppReactPdf 拆出，2026-11-27；状态在 use-reader-finder）。
// 2026-11-28 起开关在顶栏左段（ReaderFinderToggles 由阅读页摆），这里只画中间工作区里的那一栏；
// 待处理的数据和 N / Shift+N 也由阅读页拿（useReaderIssueNav），顶栏的角标和这里的列表用同一份。
import type { ReactElement } from "react";

import { ReaderFinder } from "../components/react-pdf/ReaderFinder.js";
import { ReaderBookmarkList, ReaderIssueList } from "../components/react-pdf/ReaderSidebarLists.js";
import { useReaderContext, useReaderHudContext } from "../components/react-pdf/reader-context.js";
import type { ReaderIssueNav } from "../hooks/use-reader-issues.js";
import type { ReaderFinderState } from "./use-reader-finder.js";

export function ReaderFinderArea({ state, bookmarkScope, issues }: {
  state: ReaderFinderState;
  /** 书签按这本书存（和阅读位置同一个 scope）；空的就没有「书签」页签。 */
  bookmarkScope: string;
  /** 待处理（阅读页拿的那一份）；没有就没有这个页签。 */
  issues: ReaderIssueNav;
}): ReactElement | null {
  const { finder, setFinder, findQuery, setFindQuery, findTerm, findFocus, jumpFromFinder, jumpToPageFromFinder, pinned } = state;
  const ctx = useReaderContext();
  const hud = useReaderHudContext();
  const currentPage = hud?.currentPage ?? 1;
  const issueCount = issues.issues.length;
  return (
    <>
      {finder ? (
        <ReaderFinder
          tab={finder}
          onTab={setFinder}
          onClose={() => setFinder(null)}
          onJump={jumpFromFinder}
          query={findQuery}
          onQuery={setFindQuery}
          term={findTerm}
          focusSignal={findFocus}
          pinned={pinned}
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
