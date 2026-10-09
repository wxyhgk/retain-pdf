// 文件夹展开后的详情视图:返回按钮 + 标题 + loading/error/empty/书目网格。
import { EmptyState } from "@/ui/icons/EmptyState.jsx";
import { BookCard, buildDefaultBookCardActions } from "@/features/library/index.js";
import type { LibraryCardItem } from "@/features/library/index.js";
import type { CollectionsLibraryActions } from "./types.js";

type CollectionsFolderViewProps = {
  folder: { collection_id?: string; name?: string };
  loading: boolean;
  error: string;
  items: LibraryCardItem[];
  onBack: () => void;
  onRetry: () => void;
  libraryActions: CollectionsLibraryActions;
};

export function CollectionsFolderView({
  folder,
  loading,
  error,
  items,
  onBack,
  onRetry,
  libraryActions,
}: CollectionsFolderViewProps) {
  return (
    <section id="categories-folder-view" className="library-view categories-view collections-view" aria-label={`合集:${folder.name}`} data-collections-view="true">
      <div className="categories-folder-head collections-folder-head">
        <button
          id="categories-back-btn"
          type="button"
          className="categories-back-btn"
          onClick={onBack}
        >
          ← 返回合集
        </button>
        <h2>{folder.name}</h2>
      </div>
      {loading ? (
        <div className="events-empty">正在加载…</div>
      ) : error ? (
        <div className="events-empty">
          <p>{error}</p>
          <button
            type="button"
            className="app-button secondary"
            style={{ marginTop: 12 }}
            onClick={onRetry}
          >
            重试
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          instrument="balance"
          title="这个合集暂无书"
          hint="点合集卡片上的「管理」，从书库勾选 PDF 放进来。"
        />
      ) : (
        <div className="recent-jobs-list library-grid">
          {items.map((item) => (
            <BookCard
              key={item.job_id}
              item={item}
              actions={buildDefaultBookCardActions(item, {
                onReader: libraryActions.openJobReader,
                onReadSource: libraryActions.openSourceReader,
              })}
              onSelect={libraryActions.selectJob}
              onOpenDetail={libraryActions.openBookDetail}
            />
          ))}
        </div>
      )}
    </section>
  );
}
