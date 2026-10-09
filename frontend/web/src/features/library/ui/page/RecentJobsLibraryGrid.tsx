import { BookCard, buildDefaultBookCardActions } from "../shell/BookCard.jsx";
import { BookListRow } from "../shell/BookListRow.jsx";
import { libraryCardIdentity } from "../../domain/recent-jobs/library-card-identity.js";
import { libraryItemDocumentId } from "./recent-jobs-library-helpers.js";
import type { LibraryActions, LibraryCardItem } from "../../domain/types.js";

type RecentJobsLibraryGridProps = {
  visibleItems: LibraryCardItem[];
  viewMode: string;
  mode: string;
  batchMode: boolean;
  effectiveSelectedIds: Set<string>;
  actions: LibraryActions;
  toggleSelect: (documentId: string) => void;
};

// 卡片网格/列表渲染(从 RecentJobsLibrary 抽出,保持同一 DOM 结构与 class)。
export function RecentJobsLibraryGrid({
  visibleItems,
  viewMode,
  mode,
  batchMode,
  effectiveSelectedIds,
  actions,
  toggleSelect,
}: RecentJobsLibraryGridProps) {
  return (
    <div id="library-grid" className={viewMode === "list" ? "" : "recent-jobs-list library-grid"}>
      <div
        id="recent-jobs-list"
        className={`${viewMode === "list" ? "flex flex-col gap-1" : "recent-jobs-list library-grid"}${mode === "list" ? "" : " hidden"}`}
      >
        {visibleItems.map((item) => (
          viewMode === "list" ? (
            <BookListRow
              key={libraryCardIdentity(item)}
              item={item}
              onSelect={actions.selectJob}
              onReader={actions.openJobReader}
              onReadSource={actions.openSourceReader}
              onOpenDetail={actions.openBookDetail}
              batchMode={batchMode}
              selected={effectiveSelectedIds.has(libraryItemDocumentId(item))}
              onToggleSelect={toggleSelect}
            />
          ) : (
            <BookCard
              key={libraryCardIdentity(item)}
              item={item}
              // 壳 + 按钮:默认只有「快速阅读」;要加翻译等在此 concat 即可
              actions={buildDefaultBookCardActions(item, {
                onReader: actions.openJobReader,
                onReadSource: actions.openSourceReader,
              })}
              onSelect={actions.selectJob}
              onOpenDetail={actions.openBookDetail}
              batchMode={batchMode}
              selected={effectiveSelectedIds.has(libraryItemDocumentId(item))}
              onToggleSelect={toggleSelect}
            />
          )
        ))}
      </div>
    </div>
  );
}
