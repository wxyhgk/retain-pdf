// Hợp đồng viewPort của engine recent-jobs → triển khai React (bản thiết kế §2 features/library/).
//
// Quy tắc bất biến: không sửa một dòng nào của engine polling/patch/throttle
// (controller/runtime/loader/commit/bindings…); tại đây chỉ đáp ứng 10 hợp đồng
// phương thức do view-port.js định nghĩa, đổi side effect từ "thao tác DOM" thành
// "ghi libraryViewStore". renderList cố ý bỏ qua tham số items — component React
// đọc nội dung danh sách trực tiếp từ recentJobsStatePort.store; tại đây chỉ
// chuyển hasMore để điều khiển khả năng hiển thị nút load-more.
//
// hasView() luôn true: loader.js dùng nó để bỏ qua tải khi "host không tồn tại",
// còn trong React, giao diện thư viện luôn được mount. replaceCard() luôn true:
// khi storeDrivenRendering bật, engine không dùng giá trị trả về để rẽ nhánh
// render; thẻ React re-render theo so sánh chữ ký memo (xem RecentJobCard.jsx).
// Giá trị true ở đây chỉ đáp ứng ngữ nghĩa "không thất bại" của caller.

import { createLibraryViewStore } from "./library-view-store.js";
import type {
  AutoLoadCheckOptions,
  LibraryViewStore,
  RecentJobsReactViewPort,
  RecentJobsReactViewPortOptions,
  RecentJobsViewPortHandlers,
} from "../types.js";

export function createRecentJobsReactViewPort({
  store = createLibraryViewStore(),
}: RecentJobsReactViewPortOptions = {}): RecentJobsReactViewPort {
  const viewStore: LibraryViewStore = store;
  const handlersRef: { current: RecentJobsViewPortHandlers } = {
    current: { onOpen: null, onLoadMore: null, onSearch: null, isSuspended: () => false },
  };
  const autoLoadCheckerRef: {
    current: null | ((options?: AutoLoadCheckOptions) => void);
  } = { current: null };

  function hasView() {
    return true;
  }

  function renderLoading() {
    viewStore.actions.setLoading();
  }

  function renderEmpty(message?: string) {
    viewStore.actions.setEmpty(message);
  }

  function renderError(message?: string, { reset = false }: { reset?: boolean } = {}) {
    if (reset) {
      viewStore.actions.setErrorReset(message);
      return;
    }
    // Mô phỏng nhánh reset:false của applyRecentJobsErrorState cũ: chỉ xóa trạng
    // thái tải load-more, không hiển thị thông báo lỗi (lỗi đi qua error-box,
    // không render vượt quyền tại đây).
    viewStore.actions.clearLoadMoreLoading();
  }

  function renderList({ hasMore = false }: { hasMore?: boolean } = {}) {
    viewStore.actions.setList(hasMore);
  }

  function replaceCard() {
    return true;
  }

  function setLoadMoreLoading() {
    viewStore.actions.setLoadMoreLoading();
  }

  function setDialogOpen() {
    // Hình thái phần tử recent-jobs-dialog không bật trong giao diện chính
    // (bản thiết kế §2); giữ phương thức hợp đồng là no-op để mọi đường gọi
    // còn sót trong engine không ném lỗi.
  }

  function scheduleAutoLoadCheck(options?: AutoLoadCheckOptions) {
    autoLoadCheckerRef.current?.(options);
  }

  // Phương thức ngoài hợp đồng: useLibraryAutoLoad dùng nó để nối hàm kiểm tra
  // hình học vào chuỗi gọi scheduleAutoLoadCheck (refresh-scheduler.js gọi sau
  // mỗi lần gửi phân trang).
  function registerAutoLoadChecker(
    checker: ((options?: AutoLoadCheckOptions) => void) | null | undefined,
  ) {
    autoLoadCheckerRef.current = typeof checker === "function" ? checker : null;
    return () => {
      if (autoLoadCheckerRef.current === checker) {
        autoLoadCheckerRef.current = null;
      }
    };
  }

  function bindEvents({
    onOpen,
    onLoadMore,
    onSearch,
    isSuspended = () => false,
  }: Partial<RecentJobsViewPortHandlers> = {}) {
    handlersRef.current = { onOpen, onLoadMore, onSearch, isSuspended };
  }

  return {
    store: viewStore,
    handlersRef,
    bindEvents,
    hasView,
    registerAutoLoadChecker,
    renderEmpty,
    renderError,
    renderList,
    renderLoading,
    replaceCard,
    scheduleAutoLoadCheck,
    setDialogOpen,
    setLoadMoreLoading,
  };
}
