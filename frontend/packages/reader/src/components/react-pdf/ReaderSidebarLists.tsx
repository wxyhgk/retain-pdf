// 左栏的「书签」「待处理」两个页签（2026-11-27 从底栏的两个弹出框挪进来）。
// 书签：这本书存在本机的书签，点一条跳到那一页，× 删掉；加书签照旧是底栏那一颗（ReaderBookmarkControl）。
// 待处理：这次翻译里要人看一眼的段落，按类分组，点一条跳过去（悬停那一段就能「改」）；N / Shift+N 在 useReaderIssueNav 里。
import type { ReactElement } from "react";
import { Button } from "@retainpdf/ui";

import type { ReaderIssue } from "../../contracts/session.js";
import { useReaderBookmarks } from "../../hooks/use-reader-bookmarks.js";
import { ISSUE_KIND_ORDER, ISSUE_KIND_TITLES, type ReaderIssueNav } from "../../hooks/use-reader-issues.js";
import type { ReaderRegion } from "../../shared/data/reader-regions.js";

export function ReaderBookmarkList({ scope, regions, currentPage, numPages, onJumpPage }: {
  scope: string;
  regions?: readonly ReaderRegion[];
  currentPage: number;
  numPages: number;
  onJumpPage: (page: number) => void;
}): ReactElement {
  const { bookmarks, remove } = useReaderBookmarks(scope, regions);
  if (!bookmarks.length) {
    return <p className="reader-finder-empty">还没有书签。底栏的书签按钮给眼下这一页加一个。</p>;
  }
  return (
    <ol className="reader-finder-list reader-bookmark-list">
      {bookmarks.map((bookmark) => (
        <li key={bookmark.page} className={bookmark.page === currentPage ? "is-current" : ""}>
          <Button
            className="reader-finder-entry reader-bookmark-jump"
            aria-current={bookmark.page === currentPage ? "location" : undefined}
            onClick={() => onJumpPage(numPages > 0 ? Math.min(bookmark.page, numPages) : bookmark.page)}
          >
            <span className="reader-finder-entry-text">{bookmark.label || `第 ${bookmark.page} 页`}</span>
            <span className="reader-finder-entry-page">{bookmark.page}</span>
          </Button>
          <Button className="reader-bookmark-remove" aria-label={`删除第 ${bookmark.page} 页的书签`} title="删除这个书签" onClick={() => remove(bookmark.page)}>
            ×
          </Button>
        </li>
      ))}
    </ol>
  );
}

export function ReaderIssueList({ nav }: { nav: ReaderIssueNav }): ReactElement {
  const { issues, last, goTo } = nav;
  return (
    <div className="reader-issues">
      <p className="reader-issues-hint">点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。</p>
      {ISSUE_KIND_ORDER.map((kind) => {
        const group = issues.map((issue, index) => ({ issue, index })).filter(({ issue }) => issue.kind === kind);
        if (!group.length) return null;
        return (
          <section key={kind} className="reader-issues-group" data-issue-kind={kind}>
            <h4>{ISSUE_KIND_TITLES[kind]}<span>{group.length}</span></h4>
            <ol>
              {group.map(({ issue, index }: { issue: ReaderIssue; index: number }) => (
                <li key={`${issue.kind}:${issue.readerItemId}`}>
                  <Button className="reader-issues-item" aria-current={index === last ? "true" : undefined} onClick={() => goTo(index)}>
                    <span className="reader-issues-title">{issue.title}</span>
                    <span className="reader-issues-page">第 {issue.page} 页</span>
                    {issue.detail ? <span className="reader-issues-detail">{issue.detail}</span> : null}
                  </Button>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
