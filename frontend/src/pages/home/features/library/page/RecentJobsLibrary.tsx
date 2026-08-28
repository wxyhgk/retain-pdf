// Root component của lưới thư viện (bản thiết kế §2 features/library/).
//
// Thiết kế subscription (bản thiết kế §3): Bản thân Library dùng subscription toàn bộ snapshot không qua selector — hàm re-render grid
// rất rẻ, việc cô lập hiệu năng thực sự dựa vào memo của BookCard + cardSignatureOf (xem
// BookCard.jsx), không tạo store subscription trên từng thẻ (lợi ích bằng 0, bản thiết kế đã kiểm chứng).
//
// Phái sinh chế độ hiển thị (đã kiểm tra thực tế với engine, không phải thiết kế trực giác — xem chú thích đầu
// library-view-store.js): batch() phân trang của recentJobsStatePort khi storeDrivenRendering:true
// không bao giờ kích hoạt viewPort.renderList/renderEmpty, vì vậy "items.length > 0 ưu tiên" là
// nguồn tín hiệu duy nhất không bị lỗi thời; mode của libraryViewStore chỉ đáng tin cậy khi items rỗng
// (ba trạng thái loading/empty/error được điều khiển bởi luồng biên của renderLoading()/actions.js).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useStoreSnapshot } from "../../../../../shared/react/use-store.js";
import { useHomeServices } from "../../../home-services-context.js";
import { BookCard, buildDefaultBookCardActions } from "../shell/BookCard.jsx";
import { BookListRow } from "../shell/BookListRow.jsx";
import { LibraryToolbar } from "./LibraryToolbar.jsx";
import { LibraryFilterMenu, matchesLibraryFilter } from "./LibraryFilterMenu.jsx";
import { LibraryBatchToolbar } from "./LibraryBatchToolbar.jsx";
import { useLibraryAutoLoad } from "./useLibraryAutoLoad.js";
import { useHomeReturnRestore } from "./useHomeReturnRestore.js";
import { EmptyState } from "../../../../../shared/icons/EmptyState.jsx";
import {
  buildRecentJobsSummaryViewModel,
  HOME_LOADING_STATES,
  isLibraryOnlyItem,
  isRecentJobActive,
} from "../../../composition/external.js";

// Sắp xếp phía client (chỉ xếp các trang đã tải; /documents không có tham số sort, sắp xếp ở frontend giống dự án tham chiếu).
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
  loadMore: "Thêm",
  loadMoreLoading: "Đang tải…",
  empty: "Không có nhiệm vụ gần đây",
  emptySearch: "Không có sách phù hợp",
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

  // Chọn hàng loạt (#31): trạng thái chọn dùng document_id làm key (khớp khóa chính lưới); công tắc
  // chế độ hàng loạt báo lên HomeApp qua onBatchModeChange, để nó ẩn thanh dưới cùng (AppBottomBar) bằng
  // CSS (trong lúc batchMode nhường chỗ cho thanh công cụ hàng loạt này — cả hai đều cố định giữa đáy).
  const [batchMode, setBatchModeState] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>());
  const [batchBusy, setBatchBusy] = useState(false);
  const [collections, setCollections] = useState([]);

  function setBatchMode(next) {
    setBatchModeState(next);
    if (!next) setSelectedIds(new Set());
    onBatchModeChange?.(next);
  }
  // useCallback: tham chiếu ổn định — truyền cho từng thẻ làm onToggleSelect, nếu không
  // onToggleSelect trong areCardPropsEqual sẽ bị phán đoán khác nhau mỗi lần render,
  // RecentJobsLibrary vừa re-render là kéo theo toàn bộ thẻ re-render (memo vô ích).
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

  // Danh sách thẻ + số đếm từng trạng thái (cho panel lọc hiển thị, dựa trên các mục đã tải).
  const { tags, statusCounts } = useMemo(() => {
    const tagSet = new Set<string>();
    const counts = { done: 0, untranslated: 0, active: 0, failed: 0 };
    for (const item of items) {
      (Array.isArray(item.tags) ? item.tags : []).forEach((t: any) => t && tagSet.add(`${t}`));
      if (isLibraryOnlyItem(item)) { counts.untranslated += 1; continue; }
      const s = `${item.status || ""}`.trim();
      if (isRecentJobActive(item)) counts.active += 1;
      else if (s === "succeeded") counts.done += 1;
      else if (s === "failed") counts.failed += 1;
    }
    return { tags: [...tagSet].sort((a: string, b: string) => a.localeCompare(b, "zh-CN")), statusCounts: counts };
  }, [items]);

  const visibleItems = useMemo(() => {
    const filtered = (statusFilter === "all" && !tagFilter)
      ? items
      : items.filter((item) => matchesLibraryFilter(item, statusFilter, tagFilter, { isLibraryOnly: isLibraryOnlyItem, isActive: isRecentJobActive }));
    return sortItems(filtered, sortMode);
  }, [items, statusFilter, tagFilter, sortMode]);

  // Chọn hàng loạt chỉ tác động lên các mục "có thể chọn" (có document_id); mục job-only cực hiếm chèn lúc runtime
  // (không có document_id) không chọn được, cũng không tính vào mẫu số "chọn tất cả đã tải".
  const selectableIds = useMemo(
    () => visibleItems.map((item) => `${item.document_id || ""}`.trim()).filter(Boolean),
    [visibleItems],
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  function handleSelectAllToggle() {
    setSelectedIds(allSelected ? new Set() : new Set(selectableIds));
  }

  async function handleBatchDelete() {
    const ids = [...selectedIds];
    if (!ids.length || batchBusy) return;
    if (!window.confirm(`Xác nhận xóa ${ids.length} tài liệu đã chọn? Hành động này không thể hoàn tác.`)) return;
    setBatchBusy(true);
    try {
      const { confirmed, failed } = await actions.deleteDocuments(ids);
      if (failed === 0) toast.success(`Đã xóa ${confirmed} tài liệu`);
      else if (confirmed > 0) toast.warning(`Đã xóa ${confirmed} tài liệu, ${failed} tài liệu thất bại`);
      else toast.error("Xóa thất bại, vui lòng thử lại");
      setBatchMode(false);
    } catch (err) {
      toast.error(err?.message || "Xóa thất bại, vui lòng thử lại");
    } finally {
      setBatchBusy(false);
    }
  }

  async function handleBatchAddToCollection(collectionId) {
    const ids = [...selectedIds];
    if (!ids.length || batchBusy) return;
    setBatchBusy(true);
    try {
      await services.collections.controller.addDocuments(collectionId, ids);
      toast.success(`Đã thêm vào bộ sưu tập, tổng ${ids.length} tài liệu`);
      setBatchMode(false);
    } catch (err) {
      toast.error(err?.message || "Thêm vào bộ sưu tập thất bại, vui lòng thử lại");
    } finally {
      setBatchBusy(false);
    }
  }

  const hasItems = items.length > 0;
  const isLoading = homeState.recentJobsLoadingState === HOME_LOADING_STATES.LOADING;
  const isErrorState = !hasItems
    && (homeState.recentJobsLoadingState === HOME_LOADING_STATES.ERROR || view.mode === "error");

  const mode = hasItems ? "list" : (isLoading ? "loading" : (isErrorState ? "error" : "empty"));
  const loadMoreLoading = hasItems && isLoading;
  const emptyMessage = view.query.trim() ? VIEW_TEXT.emptySearch : VIEW_TEXT.empty;
  const errorMessage = view.mode === "error" && view.message ? view.message : (homeState.recentJobsError || VIEW_TEXT.empty);

  const summary = buildRecentJobsSummaryViewModel(recentJobs.invocationSummary, items);

  useLibraryAutoLoad({
    scrollBodyRef,
    hasMore: Boolean(recentJobs.hasMore),
    loadMoreLoading,
    viewPort,
  });

  // Quay về từ trình đọc: danh sách có chiều cao rồi mới khôi phục cuộn #recent-jobs-scroll-body
  useHomeReturnRestore(hasItems || mode === "empty" || mode === "error");

  function handleLoadMoreClick() {
    viewPort.handlersRef.current.onLoadMore?.();
  }

  return (
    <section id="library-view" className="library-view" aria-label="Thư viện">
      <div id="recent-jobs-scroll-body" className="library-scroll-body" ref={scrollBodyRef}>
        <div id="recent-jobs-summary" className="status-panel-note library-summary">{summary.text}</div>
        <div id="recent-jobs-empty" className={mode === "list" ? "hidden" : undefined}>
          {mode === "loading" ? (
            <div className="events-empty">Đang tải nhiệm vụ gần đây…</div>
          ) : mode === "error" ? (
            <div className="events-empty">{errorMessage}</div>
          ) : (
            <EmptyState
              instrument="microscope"
              title={emptyMessage || "Không có nhiệm vụ gần đây"}
              hint="PDF sẽ xuất hiện ở đây sau khi tải lên, xử lý xong có thể đọc."
            >
              <button
                type="button"
                className="app-button empty-state-action"
                onClick={() => services.workflowDialog.requestOpenUpload()}
              >
                Tải lên PDF
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
                  key={item.job_id}
                  item={item}
                  onSelect={actions.selectJob}
                  onReader={actions.openJobReader}
                  onReadSource={actions.openSourceReader}
                  onOpenDetail={actions.openBookDetail}
                  batchMode={batchMode}
                  selected={selectedIds.has(`${item.document_id || ""}`.trim())}
                  onToggleSelect={toggleSelect}
                />
              ) : (
                <BookCard
                  key={item.job_id}
                  item={item}
                  // Vỏ + nút: mặc định chỉ có "Đọc nhanh"; cần thêm dịch v.v. thì concat tại đây
                  actions={buildDefaultBookCardActions(item, {
                    onReader: actions.openJobReader,
                    onReadSource: actions.openSourceReader,
                  })}
                  onSelect={actions.selectJob}
                  onOpenDetail={actions.openBookDetail}
                  batchMode={batchMode}
                  selected={selectedIds.has(`${item.document_id || ""}`.trim())}
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
          count={selectedIds.size}
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
    </section>
  );
}

// Input tìm kiếm sử dụng handleSearchChange nằm trong khung LibraryBottomBar (HomeApp.jsx)
// — lưới thư viện và thanh tìm kiếm dưới đáy là các node anh em ngang cấp, không phải quan hệ cha con (phản chiếu
// partials/main-content.html). Export hook này để HomeApp.jsx tái sử dụng cùng kênh
// onSearch/query, tránh xuất hiện hai luồng triển khai song song.
export function useLibrarySearchBinding() {
  const services = useHomeServices();
  const { viewPort } = services.library;
  const view = useStoreSnapshot(viewPort.store);

  function onSearchChange(event) {
    const value = event.target.value;
    viewPort.store.actions.setQuery(value);
    viewPort.handlersRef.current.onSearch?.(value);
  }

  return { query: view.query, onSearchChange };
}
