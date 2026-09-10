// 概览中的阅读与归档区：阅读状态、合集归属和删除。

import { ReadingStatusPanel } from "../panels/more/ReadingStatusPanel.jsx";
import { CollectionsPanel } from "../panels/more/CollectionsPanel.jsx";
import { DeleteFooterPanel } from "../panels/more/DeleteFooterPanel.jsx";

export function BookDetailManageTab({
  readingStatus,
  busy,
  onReadingStatusChange,
  collections,
  collectionsBusy,
  onToggleCollection,
  error,
  confirmingDelete,
  onDelete,
}) {
  return (
    <div
      className="book-detail-management-section"
      data-book-detail-section="management"
    >
      <ReadingStatusPanel
        value={readingStatus}
        busy={busy}
        onChange={onReadingStatusChange}
      />
      <CollectionsPanel
        collections={collections}
        collectionsBusy={collectionsBusy}
        onToggle={onToggleCollection}
      />
      <DeleteFooterPanel
        error={error}
        confirmingDelete={confirmingDelete}
        busy={busy}
        onDelete={onDelete}
      />
    </div>
  );
}
