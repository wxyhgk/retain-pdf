// Thu gọn cột trái/phải của khung ba cột: nút chuyển đổi lớp thu gọn trên body, thu gọn cột (chiều rộng về 0), trạng thái được lưu lại.
// Thu gọn chỉ là hiệu ứng hình ảnh (không thay đổi ngăn kéo active của cột phải), khi mở rộng nội dung gốc vẫn còn.

const STORAGE_KEY = "retainpdf-reader-collapse-v1";

export function loadCollapseState(storage = globalThis.localStorage || null) {
  const blank = { left: false, right: false };
  if (!storage) {
    return blank;
  }
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") {
      return blank;
    }
    return { left: Boolean(parsed.left), right: Boolean(parsed.right) };
  } catch (_err) {
    return blank;
  }
}

export function saveCollapseState(state, storage = globalThis.localStorage || null) {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ left: Boolean(state.left), right: Boolean(state.right) }));
  } catch (_err) {
    // Hết hạn mức/ chế độ riêng tư: thất bại im lặng
  }
}

export function createReaderPanelCollapse({
  documentRef = globalThis.document,
  storage = globalThis.localStorage || null,
  onChange = null,
} = {}) {
  const body = documentRef?.body || documentRef?.querySelector?.("body");
  const leftBtn = documentRef?.getElementById?.("reader-left-collapse-btn");
  const rightBtn = documentRef?.getElementById?.("reader-right-collapse-btn");
  const state = loadCollapseState(storage);

  function apply() {
    body?.classList?.toggle?.("reader-left-collapsed", state.left);
    body?.classList?.toggle?.("reader-right-collapsed", state.right);
    // aria-expanded phản ánh "cột có đang mở"; biểu tượng tay cầm đảo theo is-collapsed (CSS)
    leftBtn?.setAttribute?.("aria-expanded", state.left ? "false" : "true");
    rightBtn?.setAttribute?.("aria-expanded", state.right ? "false" : "true");
    leftBtn?.classList?.toggle?.("is-collapsed", state.left);
    rightBtn?.classList?.toggle?.("is-collapsed", state.right);
    onChange?.();
  }

  function toggleLeft() {
    state.left = !state.left;
    saveCollapseState(state, storage);
    apply();
  }

  function toggleRight() {
    state.right = !state.right;
    saveCollapseState(state, storage);
    apply();
  }

  // Khi nhấp vào công cụ ở thanh trên cùng, nếu cột phải đang thu gọn thì tự động mở ra để hiển thị nội dung
  function expandRight() {
    if (state.right) {
      state.right = false;
      saveCollapseState(state, storage);
      apply();
    }
  }

  function bindEvents() {
    leftBtn?.addEventListener?.("click", toggleLeft);
    rightBtn?.addEventListener?.("click", toggleRight);
    apply();
  }

  return { bindEvents, toggleLeft, toggleRight, expandRight, state: () => ({ ...state }) };
}
