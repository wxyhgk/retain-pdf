// Store "tín hiệu giao diện tạm thời" của lưới thư viện (bản thiết kế §2 features/library/).
//
// Bối cảnh (đã kiểm chứng thực tế, không phải thiết kế theo trực giác):
// việc gửi batch() của recentJobsStatePort (phân trang đầu/load-more) kết hợp
// storeDrivenRendering:true khiến renderList/renderEmpty của hợp đồng viewPort cũ
// (hầu hết đường đi) không bao giờ được engine gọi thực tế — engine giao quyền
// render cho store. Vì vậy store này chỉ đảm nhiệm hai nhóm:
// 1. tín hiệu engine vẫn gọi "vô điều kiện": renderLoading()/setLoadMoreLoading()
//    (loader.js gọi ở đầu cả hai nhánh reset/load-more, không phụ thuộc
//    storeDrivenRendering);
// 2. đường biên actions.js gọi "trực tiếp", không qua cổng storeDrivenRendering:
//    - deleteJob thành công và danh sách rỗng → renderEmpty("Chưa có tác vụ gần đây")
//    - deleteJob thất bại / selectJob·openJobReader thiếu job_id → renderError(msg,{reset:false})
//      (mô phỏng applyRecentJobsErrorState cũ: reset:false chỉ ẩn nút load-more,
//      không hiển thị thông báo lỗi — lỗi đi qua error-box, không render vượt quyền tại đây)
//
// Chế độ hiển thị cuối của RecentJobsLibrary.jsx **không** đọc trực tiếp store.mode
// mà dùng logic suy ra "ưu tiên items.length > 0" (xem component), vì store.mode
// có thể giữ giá trị cũ trên đường gửi batch (ví dụ sau lần tải thành công đầu tiên
// mode vẫn là "loading"). Store này chỉ được tin là nguồn chính xác khi items rỗng.

import type {
  LibraryViewActions,
  LibraryViewState,
  LibraryViewStore,
} from "../types.js";
import { createStore } from "../../../composition/external.js";

export function createLibraryViewStore(): LibraryViewStore {
  return createStore<LibraryViewState, LibraryViewActions>({
    name: "libraryView",
    initialState: {
      mode: "loading",
      message: "",
      hasMore: false,
      loadMoreLoading: false,
      query: "",
    },
    actions: {
      setLoading(state) {
        return { ...state, mode: "loading", loadMoreLoading: false };
      },
      setEmpty(state, message = "") {
        return { ...state, mode: "empty", message: `${message || ""}`, loadMoreLoading: false };
      },
      setErrorReset(state, message = "") {
        return { ...state, mode: "error", message: `${message || ""}`, loadMoreLoading: false };
      },
      clearLoadMoreLoading(state) {
        return { ...state, loadMoreLoading: false };
      },
      setList(state, hasMore = false) {
        return { ...state, mode: "list", hasMore: Boolean(hasMore), loadMoreLoading: false };
      },
      setLoadMoreLoading(state) {
        return { ...state, loadMoreLoading: true };
      },
      setQuery(state, query = "") {
        return { ...state, query: `${query || ""}` };
      },
    },
  });
}
