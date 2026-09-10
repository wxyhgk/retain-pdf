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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { useHomeServices } from "@/app/home/home-services-context.js";
import { BookCard, buildDefaultBookCardActions } from "../shell/BookCard.jsx";
import { BookListRow } from "../shell/BookListRow.jsx";
import { LibraryToolbar } from "./LibraryToolbar.jsx";
import {
  countLibraryStatusFilters,
  LibraryFilterMenu,
  matchesLibraryFilter,
} from "./LibraryFilterMenu.jsx";
import { LibraryBatchToolbar } from "./LibraryBatchToolbar.jsx";
import { useLibraryAutoLoad } from "./useLibraryAutoLoad.js";
import { useHomeReturnRestore } from "./useHomeReturnRestore.js";
import { deriveLibraryPageState } from "../../domain/library-page-state.js";
import { EmptyState } from "@/ui/icons/EmptyState.jsx";
import { ConfirmDialog } from "@/ui/components/confirm-dialog.js";
import {
  isRecentJobActive,
} from "../../domain/card/recent-job-card-presenter.js";
import {
  isLibraryOnlyItem,
} from "../../domain/documents/document-card-item.js";
import {
  libraryCardIdentity,
} from "../../domain/recent-jobs/library-card-identity.js";
import {
  buildRecentJobsSummaryViewModel,
} from "../../domain/recent-jobs/summary-view-model.js";

// 客户端排序(只排已加载的这几页;/documents 无 sort 参数,和参考项目一样在前端排)。
function sortItems(items, sortMode) {
  const arr = [...items];
  const desc = (key) => (a, b) => `${b?.[key] || ""}`.localeCompare(`${a?.[key] || ""}`);
  switch (sortMode) {
    case "created": return arr.sort(desc("added_at"));
    case "opened": return arr.sort(desc("last_opened_at"));
    case "title":
      return arr.sort((a, b) => `${a?.title || a?.display_name || ""}`.localeCompare(`${b?.title || b?.display_name || ""}`, "zh-CN"));
    case "updated":
    default:
      return arr.sort(desc("updated_at"));
  }
}

const VIEW_TEXT = Object.freeze({
  loadMore: "更多",
  loadMoreLoading: "加载中…",
});

export function RecentJobsLibrary({ onBatchModeChange }: any = {}) {
  const services = useHomeServices();
  const { viewPort, recentJobsStore, actions } = services.library;

  const recentJobs = useStoreSnapshot(recentJobsStore);
  const homeState = useStoreSnapshot(services.stores.homeState);
  const view = useStoreSnapshot(viewPort.store);

  const scrollBodyRef = useRef(null);
  const [viewMode, setViewMode] = useState("grid");
  const [sortMode, setSortMode] = useState("updated");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("");

  // 批量选择(#31):选中态用 document_id 做 key(和网格主键一致);批量模式
  // 开关经 onBatchModeChange 上报给 HomeApp,由它把底部栏(AppBottomBar)用
  // CSS 隐藏(batchMode 期间让位给这条批量工具栏——两者都固定在底部居中)。
  const [batchMode, setBatchModeState] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>());
  const [batchBusy, setBatchBusy] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [collections, setCollections] = useState([]);

  function setBatchMode(next) {
    setBatchModeState(next);
    if (!next) setSelectedIds(new Set());
    onBatchModeChange?.(next);
  }
  // useCallback:稳定引用——传给每张卡片当 onToggleSelect,不然
  // areCardPropsEqual 里的 onToggleSelect 每次 render 都判不相等,
  // RecentJobsLibrary 一重渲就拖着所有卡片一起重渲(memo 白做)。
  const toggleSelect = useCallback((documentId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!batchMode) return;
    services.collections?.controller?.listCollections().then((list) => {
      const rows = Array.isArray(list?.collections) ? list.collections : (Array.isArray(list) ? list : []);
      setCollections(rows);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchMode]);

  const items = Array.isArray(recentJobs.items) ? recentJobs.items : [];

  // 标签列表 + 各状态计数(供筛选面板显示,基于已加载项)。
  const { tags, statusCounts } = useMemo(() => {
    const tagSet = new Set<string>();
    for (const item of items) {
      (Array.isArray(item.tags) ? item.tags : []).forEach((t: any) => t && tagSet.add(`${t}`));
    }
    return {
      tags: [...tagSet].sort((a: string, b: string) => a.localeCompare(b, "zh-CN")),
      statusCounts: countLibraryStatusFilters(items, {
        isLibraryOnly: isLibraryOnlyItem,
        isActive: isRecentJobActive,
      }),
    };
  }, [items]);

  const visibleItems = useMemo(() => {
    const filtered = (statusFilter === "all" && !tagFilter)
      ? items
      : items.filter((item) => matchesLibraryFilter(item, statusFilter, tagFilter, { isLibraryOnly: isLibraryOnlyItem, isActive: isRecentJobActive }));
    return sortItems(filtered, sortMode);
  }, [items, statusFilter, tagFilter, sortMode]);

  // 批量选择只作用"可选中"的项(有 document_id 的);极少见的运行时插入
  // job-only 项(无 document_id)选不了,也不计入"全选已加载"的分母。
  const selectableIds = useMemo(
    () => visibleItems.map((item) => `${item.document_id || ""}`.trim()).filter(Boolean),
    [visibleItems],
  );
  const selectableIdSet = useMemo(() => new Set(selectableIds), [selectableIds]);
  const effectiveSelectedIds = useMemo(() => {
    const next = new Set<string>();
    for (const id of selectedIds) {
      if (selectableIdSet.has(id)) next.add(id);
    }
    return next;
  }, [selectedIds, selectableIdSet]);

  // 删除、整页刷新或筛选都会改变当前可操作集合。同步清掉已不可见的选择，
  // 避免工具栏计数和后续批量命令继续携带“幽灵” document_id。
  useEffect(() => {
    setSelectedIds((previous) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of previous) {
        if (selectableIdSet.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : previous;
    });
  }, [selectableIdSet]);

  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => effectiveSelectedIds.has(id));

  function handleSelectAllToggle() {
    setSelectedIds(allSelected ? new Set() : new Set(selectableIds));
  }

  function handleBatchDelete() {
    const ids = [...effectiveSelectedIds];
    if (!ids.length || batchBusy) return;
    setPendingDeleteIds(ids);
  }

  async function confirmBatchDelete() {
    const ids = pendingDeleteIds || [];
    if (!ids.length || batchBusy) return;
    setBatchBusy(true);
    try {
      const { confirmed, failed } = await actions.deleteDocuments(ids);
      if (failed === 0) toast.success(`已删除 ${confirmed} 篇`);
      else if (confirmed > 0) toast.warning(`已删除 ${confirmed} 篇，${failed} 篇失败`);
      else toast.error("删除失败，请稍后重试");
      setBatchMode(false);
    } catch (err) {
      toast.error(err?.message || "删除失败，请稍后重试");
    } finally {
      setBatchBusy(false);
      setPendingDeleteIds(null);
    }
  }

  async function handleBatchAddToCollection(collectionId) {
    const ids = [...effectiveSelectedIds];
    if (!ids.length || batchBusy) return;
    setBatchBusy(true);
    try {
      await services.collections.controller.addDocuments(collectionId, ids);
      toast.success(`已加入合集，共 ${ids.length} 篇`);
      setBatchMode(false);
    } catch (err) {
      toast.error(err?.message || "加入合集失败，请稍后重试");
    } finally {
      setBatchBusy(false);
    }
  }

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
        <div id="recent-jobs-empty" className={mode === "list" ? "hidden" : undefined}>
          {mode === "loading" ? (
            <div className="events-empty">正在加载最近任务…</div>
          ) : mode === "error" ? (
            <div className="events-empty">{errorMessage}</div>
          ) : (
            <EmptyState
              instrument="microscope"
              title={emptyMessage || "暂无最近任务"}
              hint="上传 PDF 后会出现在这里，处理完成即可阅读。"
            >
              <button
                type="button"
                className="app-button empty-state-action"
                onClick={() => services.workflowDialog.requestOpenUpload()}
              >
                上传 PDF
              </button>
            </EmptyState>
          )}
        </div>
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
                  selected={effectiveSelectedIds.has(`${item.document_id || ""}`.trim())}
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
                  selected={effectiveSelectedIds.has(`${item.document_id || ""}`.trim())}
                  onToggleSelect={toggleSelect}
                />
              )
            ))}
          </div>
        </div>
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
      <ConfirmDialog
        id="batch-delete-confirm-dialog"
        open={Boolean(pendingDeleteIds)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingDeleteIds(null);
        }}
        title="删除所选文档？"
        description={`将永久删除选中的 ${pendingDeleteIds?.length || 0} 篇文档，此操作无法撤销。`}
        confirmLabel="确认删除"
        pending={batchBusy}
        tone="danger"
        onConfirm={confirmBatchDelete}
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
