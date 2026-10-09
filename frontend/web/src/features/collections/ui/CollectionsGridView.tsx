// 合集网格视图:新建按钮 + loading/error/empty/文件夹卡片网格。
import { EmptyState } from "@/ui/icons/EmptyState.jsx";
import type { LibraryCardItem } from "@/features/library/index.js";
import { FolderCoverStack } from "./FolderCoverStack.jsx";
import type { CollectionRecord } from "../domain/controller.js";

type CollectionsGridViewProps = {
  collections: CollectionRecord[];
  previews: Record<string, LibraryCardItem[]>;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onCreate: () => void;
  onOpenFolder: (collection: CollectionRecord) => void;
  onManage: (collection: CollectionRecord) => void;
};

export function CollectionsGridView({
  collections,
  previews,
  loading,
  error,
  onRetry,
  onCreate,
  onOpenFolder,
  onManage,
}: CollectionsGridViewProps) {
  return (
    <section id="categories-view" className="library-view categories-view collections-view" aria-label="合集" data-collections-view="true">
      <div className="categories-head collections-head">
        <button
          id="categories-create-btn"
          type="button"
          className="app-button"
          onClick={onCreate}
        >
          新建合集
        </button>
      </div>
      {loading ? (
        <div className="events-empty">正在加载合集…</div>
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
      ) : collections.length === 0 ? (
        <EmptyState
          id="categories-empty"
          instrument="telescope"
            title="暂无合集"
          hint="把 PDF 按主题分组成书架，之后更好找。"
        >
          <button
            type="button"
            className="app-button empty-state-action"
            onClick={onCreate}
          >
            新建合集
          </button>
        </EmptyState>
      ) : (
        <div id="categories-grid" className="categories-grid collections-grid" data-collections-grid="true">
          {collections.map((collection) => (
            <div key={collection.collection_id} className="category-card collection-card">
              <button
                type="button"
                className="category-card-open"
                onClick={() => onOpenFolder(collection)}
              >
                <FolderCoverStack items={previews[collection.collection_id]} />
                <span className="category-card-name" title={collection.name}>{collection.name}</span>
                <span className="category-card-count">{collection.document_count} 本</span>
              </button>
              <button
                type="button"
                className="category-card-manage"
                aria-label={`管理合集 ${collection.name}`}
                title="管理"
                onClick={(event) => {
                  event.stopPropagation();
                  onManage(collection);
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" stroke="currentColor" strokeWidth="1.65" fill="none" />
                  <path d="M19.1 13.2c.06-.39.09-.79.09-1.2s-.03-.81-.09-1.2l2.02-1.55-1.9-3.29-2.38.96a8.01 8.01 0 0 0-2.08-1.2L14.4 3.2h-3.8l-.36 2.52c-.75.28-1.45.69-2.08 1.2l-2.38-.96-1.9 3.29L5.9 10.8c-.06.39-.09.79-.09 1.2s.03.81.09 1.2l-2.02 1.55 1.9 3.29 2.38-.96c.63.51 1.33.92 2.08 1.2l.36 2.52h3.8l.36-2.52c.75-.28 1.45-.69 2.08-1.2l2.38.96 1.9-3.29-2.02-1.55Z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" fill="none" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
