// Nguồn trạng thái đóng/mở bốn drawer (favorites/annotations/markdown/ai): active đơn nhất,
// chuyển qua lại loại trừ. Thay thế ngữ nghĩa trạng thái của src/js/reader/side-drawers.js
// cũ; thao tác ghi DOM (is-open/inert/aria-expanded) đổi sang component React đăng ký
// render, phía tiêu thụ mệnh lệnh (ai-context, selection-favorites, điều phối boot) vẫn
// lấy cùng store đó làm drawerController (chữ ký open/toggle/close không đổi).
//
// Bảo toàn ngữ nghĩa (khớp với side-drawers cũ):
// - open/toggle/close mỗi lần gọi đều thông báo cho người đăng ký (dù active không đổi)
//   — sync() cũ chạy vô điều kiện, phía tiêu thụ onActiveChanged (scheduleScaleRefresh
//   v.v.) phụ thuộc nhịp "mỗi lần đều tới" này.
// - close(name): không truyền name hoặc name đúng là active hiện tại mới xóa.

export type DrawerActiveListener = (active: string) => void;

export function createReaderDrawerStore() {
  let active = "";
  const listeners = new Set<DrawerActiveListener>();

  function notify() {
    listeners.forEach((listener) => listener(active));
  }

  return {
    // Tương thích useSyncExternalStore: subscribe trả về hàm hủy đăng ký; listener mang
    // theo active làm tham số
    subscribe(listener: DrawerActiveListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getActive: () => active,
    active: () => active,
    open(name) {
      active = name;
      notify();
      return active;
    },
    toggle(name) {
      active = active === name ? "" : name;
      notify();
      return active;
    },
    close(name = "") {
      if (!name || active === name) {
        active = "";
      }
      notify();
      return active;
    },
  };
}
