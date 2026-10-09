// 图书馆网格根组件(蓝图 §2 features/library/)。
//
// 订阅设计(蓝图 §3):Library 本体走无 selector 全快照订阅——重渲 grid 函数
// 本体便宜,真正的性能隔离靠 BookCard 的 memo + cardSignatureOf(见
// BookCard.jsx),不做 per-card store 订阅(收益零,蓝图已验证)。
//
// 展示模式派生(经与引擎实测核实,非直觉设计——见 library-view-store.js 顶部
// 注释):recentJobsStatePort 的 batch() 分页提交在 storeDrivenRendering:true
// 下从不触发 viewPort.renderList/renderEmpty,所以"items.length > 0 优先"是
// 唯一不会陈旧的信号源;libraryViewStore 的 mode 只在 items 为空时才可信
// (loading/empty/error 三态由 renderLoading()/actions.js 的边缘路径驱动)。

import { useRef, useState } from "react";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import {
  useHomeCollections,
  useHomeHomeStateStore,
  useHomeLibrary,
  useHomeWorkflowDialog,
} from "@/ui/context/home-services-context.js";
import { LibraryToolbar } from "./LibraryToolbar.jsx";
import { LibraryFilterMenu } from "./LibraryFilterMenu.jsx";
import { LibraryBatchToolbar } from "./LibraryBatchToolbar.jsx";
import { useLibraryAutoLoad } from "./useLibraryAutoLoad.js";
import { useHomeReturnRestore } from "./useHomeReturnRestore.js";
import { deriveLibraryPageState } from "../../domain/library-page-state.js";
import {
  buildRecentJobsSummaryViewModel,
} from "../../domain/recent-jobs/summary-view-model.js";
import { RecentJobsLibraryEmpty } from "./RecentJobsLibraryEmpty.jsx";
import { RecentJobsLibraryGrid } from "./RecentJobsLibraryGrid.jsx";
import { RecentJobsLibraryBatchDialogs } from "./RecentJobsLibraryBatchDialogs.jsx";
import { useRecentJobsListDerivation } from "./useRecentJobsListDerivation.js";
import { useRecentJobsBatchSelection } from "./useRecentJobsBatchSelection.js";
import { VIEW_TEXT } from "./recent-jobs-library-helpers.js";

export function RecentJobsLibrary({ onBatchModeChange }: { onBatchModeChange?: (active: boolean) => void } = {}) {
  const { viewPort, recentJobsStore, actions } = useHomeLibrary();
  const homeStateStore = useHomeHomeStateStore();
  const { controller: collectionsController } = useHomeCollections();
  const workflowDialog = useHomeWorkflowDialog();

  const recentJobs = useStoreSnapshot(recentJobsStore);
  const homeState = useStoreSnapshot(homeStateStore);
  const view = useStoreSnapshot(viewPort.store);

  const scrollBodyRef = useRef(null);
  const [viewMode, setViewMode] = useState("grid");
  const [sortMode, setSortMode] = useState("updated");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("");

  const items = Array.isArray(recentJobs.items) ? recentJobs.items : [];

  const { tags, statusCounts, visibleItems } = useRecentJobsListDerivation({
    items,
    statusFilter,
    tagFilter,
    sortMode,
  });

  const {
    batchMode,
    setBatchMode,
    effectiveSelectedIds,
    selectableIds,
    allSelected,
    batchBusy,
    pendingDeleteIds,
    setPendingDeleteIds,
    pendingBlockedDelete,
    setPendingBlockedDelete,
    collections,
    toggleSelect,
    handleSelectAllToggle,
    handleBatchDelete,
    confirmBatchDelete,
    confirmClearFavoritesBatchDelete,
    handleBatchAddToCollection,
    blockedFavoriteTotal,
  } = useRecentJobsBatchSelection({
    visibleItems,
    onBatchModeChange,
    collectionsController,
    actions,
  });

  const {
    mode,
    loadMoreLoading,
    emptyMessage,
    errorMessage,
  } = deriveLibraryPageState({
    items,
    loadingState: homeState.recentJobsLoadingState,
    error: homeState.recentJobsError,
    query: view.query,
    viewMode: view.mode,
    viewMessage: view.message,
  });
  const hasItems = mode === "list";

  const summary = buildRecentJobsSummaryViewModel(recentJobs.invocationSummary, items);

  useLibraryAutoLoad({
    scrollBodyRef,
    hasMore: Boolean(recentJobs.hasMore),
    loadMoreLoading,
    viewPort,
  });

  // 从阅读器返回：列表有高度后再恢复 #recent-jobs-scroll-body 滚动
  useHomeReturnRestore(hasItems || mode === "empty" || mode === "error");

  function handleLoadMoreClick() {
    viewPort.handlersRef.current.onLoadMore?.();
  }

  return (
    <section id="library-view" className="library-view" aria-label="图书馆">
      <div id="recent-jobs-scroll-body" className="library-scroll-body" ref={scrollBodyRef}>
        <div id="recent-jobs-summary" className="status-panel-note library-summary">{summary.text}</div>
        <RecentJobsLibraryEmpty
          mode={mode}
          errorMessage={errorMessage}
          emptyMessage={emptyMessage}
          onUpload={() => workflowDialog.requestOpenUpload()}
        />
        {mode === "list" ? (
          <LibraryToolbar
            count={visibleItems.length}
            viewMode={viewMode}
            setViewMode={setViewMode}
            sortMode={sortMode}
            setSortMode={setSortMode}
            batchMode={batchMode}
            onToggleBatchMode={setBatchMode}
            filterSlot={(
              <LibraryFilterMenu
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                tagFilter={tagFilter}
                setTagFilter={setTagFilter}
                tags={tags}
                statusCounts={statusCounts}
              />
            )}
          />
        ) : null}
        <RecentJobsLibraryGrid
          visibleItems={visibleItems}
          viewMode={viewMode}
          mode={mode}
          batchMode={batchMode}
          effectiveSelectedIds={effectiveSelectedIds}
          actions={actions}
          toggleSelect={toggleSelect}
        />
        <div className="recent-jobs-more-row">
          <button
            id="load-more-jobs-btn"
            className={`secondary${recentJobs.hasMore ? "" : " hidden"}`}
            type="button"
            disabled={loadMoreLoading}
            onClick={handleLoadMoreClick}
          >
            {loadMoreLoading ? VIEW_TEXT.loadMoreLoading : VIEW_TEXT.loadMore}
          </button>
        </div>
      </div>
      {batchMode ? (
        <LibraryBatchToolbar
          count={effectiveSelectedIds.size}
          totalSelectable={selectableIds.length}
          allSelected={allSelected}
          onSelectAll={handleSelectAllToggle}
          onCancel={() => setBatchMode(false)}
          onDelete={handleBatchDelete}
          collections={collections}
          onAddToCollection={handleBatchAddToCollection}
          busy={batchBusy}
        />
      ) : null}
      <RecentJobsLibraryBatchDialogs
        pendingDeleteIds={pendingDeleteIds}
        pendingBlockedDelete={pendingBlockedDelete}
        blockedFavoriteTotal={blockedFavoriteTotal}
        batchBusy={batchBusy}
        onCancelDelete={() => setPendingDeleteIds(null)}
        onConfirmDelete={confirmBatchDelete}
        onCancelBlocked={() => setPendingBlockedDelete(null)}
        onConfirmBlocked={confirmClearFavoritesBatchDelete}
      />
    </section>
  );
}

// 使用 handleSearchChange 的搜索输入框自身留在 LibraryBottomBar(HomeApp.jsx)
// 骨架里——图书馆网格与底部搜索栏是同级兄弟节点,不是父子关系(镜像
// 旧世界 HTML 骨架(已删除))。导出这个 hook 供 HomeApp.jsx 复用同一条
// onSearch/query 通道,避免出现两条平行实现。
// — Decoupled: canonical implementation lives in ./use-library-search-binding.js;
//   AppBottomBar imports it from @/features/library/index.js（本功能唯一出口），
//   而不是直连本文件，避免 app-shell 反向依赖 library 的内部模块。
export { useLibrarySearchBinding } from "./use-library-search-binding.js";
