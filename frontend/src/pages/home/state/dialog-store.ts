// Hàm tạo trạng thái đóng/mở dialog chung (bản thiết kế §0.3) — <dialog> gốc thường
// trú mount của CredentialsDialog/GlossariesDialog/chi tiết AppUpdate/SettingsHubDialog
// v.v. dùng chung một bộ ngữ nghĩa.
//
// Tham chiếu mô hình src/pages/reader/legacy/state/drawer-store.js (hợp đồng open/subscribe),
// nhưng dialog không phải "chọn một loại trừ" mà là "đóng/mở một cái + payload tùy chọn"
// (setupMode, tab khởi đầu v.v.), nên hình dạng trạng thái là { open, payload } chứ không
// phải chuỗi active đơn như drawer.
//
// Tham chiếu đối tượng getState() trả về chỉ cập nhật khi gọi open()/close() (không tạo
// mới mỗi lần đọc), có thể trực tiếp nạp vào useSyncExternalStore mà không kích hoạt
// vòng lặp render vô hạn (không có bãi cạn clone getSnapshot của app-framework/store.js).

export type DialogState<T = unknown> = {
  open: boolean;
  payload: T;
};

export type DialogStore<T = unknown> = {
  subscribe: (listener: (state: DialogState<T>) => void) => () => void;
  getState: () => DialogState<T>;
  open: (payload?: T | null) => DialogState<T>;
  close: () => DialogState<T>;
};

export function createDialogStore<T = unknown>(initialPayload: T | null = null): DialogStore<T> {
  let state: DialogState<T> = { open: false, payload: initialPayload as T };
  const listeners = new Set<(state: DialogState<T>) => void>();

  function notify() {
    listeners.forEach((listener) => listener(state));
  }

  return {
    // Tương thích useSyncExternalStore: subscribe trả về hàm hủy đăng ký
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getState: () => state,
    open(payload = null) {
      state = { open: true, payload: payload === null ? state.payload : (payload as T) };
      notify();
      return state;
    },
    close() {
      if (!state.open) {
        return state;
      }
      state = { open: false, payload: state.payload };
      notify();
      return state;
    },
  };
}
