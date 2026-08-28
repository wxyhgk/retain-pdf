// Kéo thay đổi chiều rộng cột trái/phải của khung ba cột: di chuyển con trỏ phân cách để cập nhật biến CSS theo thời gian thực, thả tay để lưu trạng thái.
// Tính toán chiều rộng (clampColumnWidth) và lưu trạng thái (load/save) được tách riêng để thuận tiện cho kiểm thử đơn vị; DOM kéo thả được đóng gói mỏng.

export const READER_COLUMN_LIMITS = {
  left: { min: 180, max: 460, default: 248 },
  right: { min: 300, max: 620, default: 384 },
};

const STORAGE_KEY = "retainpdf-reader-cols-v1";

// Kẹp giá trị vào pixel nguyên trong [min, max]; đầu vào không hợp lệ quay về default.
export function clampColumnWidth(px, { min, max, default: fallback }) {
  const value = Number(px);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function loadColumnWidths(storage = globalThis.localStorage || null) {
  const defaults = {
    left: READER_COLUMN_LIMITS.left.default,
    right: READER_COLUMN_LIMITS.right.default,
  };
  if (!storage) {
    return defaults;
  }
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") {
      return defaults;
    }
    return {
      left: clampColumnWidth(parsed.left ?? defaults.left, READER_COLUMN_LIMITS.left),
      right: clampColumnWidth(parsed.right ?? defaults.right, READER_COLUMN_LIMITS.right),
    };
  } catch (_err) {
    return defaults;
  }
}

export function saveColumnWidths(widths, storage = globalThis.localStorage || null) {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ left: widths.left, right: widths.right }));
  } catch (_err) {
    // Hết hạn mức/chế độ riêng tư: thất bại im lặng
  }
}

export function createReaderColumnResizer({
  documentRef = globalThis.document,
  storage = globalThis.localStorage || null,
  onResize = null,
} = {}) {
  const body = documentRef?.body || documentRef?.querySelector?.("body");
  const leftHandle = documentRef?.getElementById?.("reader-col-resizer-left");
  const rightHandle = documentRef?.getElementById?.("reader-col-resizer-right");
  const widths = loadColumnWidths(storage);

  function setVar(name, value) {
    body?.style?.setProperty?.(name, `${value}px`);
  }

  // "Chiều rộng mở" cột trái: applied width --reader-left-w được CSS kế thừa từ nó, khi thu gọn bị lớp ghi đè thành 0
  function applyLeft(px) {
    widths.left = clampColumnWidth(px, READER_COLUMN_LIMITS.left);
    setVar("--reader-left-col", widths.left);
    return widths.left;
  }

  // "Chiều rộng mở" cột phải: khi ::has(.is-open) cột phải dùng nó, khi thu gọn cột phải = 0 (xem CSS)
  function applyRight(px) {
    widths.right = clampColumnWidth(px, READER_COLUMN_LIMITS.right);
    setVar("--reader-right-col", widths.right);
    return widths.right;
  }

  function viewportWidth() {
    return documentRef?.defaultView?.innerWidth
      || globalThis.window?.innerWidth
      || 1280;
  }

  function bindHandle(handle, side) {
    if (!handle?.addEventListener) {
      return;
    }
    let dragging = false;

    function onMove(event) {
      if (!dragging) {
        return;
      }
      const clientX = Number(event.clientX) || 0;
      if (side === "left") {
        applyLeft(clientX);
      } else {
        applyRight(viewportWidth() - clientX);
      }
      onResize?.();
    }

    function onUp(event) {
      if (!dragging) {
        return;
      }
      dragging = false;
      body?.classList?.remove?.("reader-resizing");
      handle.releasePointerCapture?.(event.pointerId);
      documentRef?.removeEventListener?.("pointermove", onMove);
      documentRef?.removeEventListener?.("pointerup", onUp);
      saveColumnWidths(widths, storage);
      onResize?.();
    }

    handle.addEventListener("pointerdown", (event) => {
      dragging = true;
      body?.classList?.add?.("reader-resizing");
      handle.setPointerCapture?.(event.pointerId);
      documentRef?.addEventListener?.("pointermove", onMove);
      documentRef?.addEventListener?.("pointerup", onUp);
      event.preventDefault?.();
    });

    // Nhấp đúp vào thanh phân cách: khôi phục chiều rộng mặc định của cột
    handle.addEventListener("dblclick", () => {
      if (side === "left") {
        applyLeft(READER_COLUMN_LIMITS.left.default);
      } else {
        applyRight(READER_COLUMN_LIMITS.right.default);
      }
      saveColumnWidths(widths, storage);
      onResize?.();
    });
  }

  function bindEvents() {
    applyLeft(widths.left);
    applyRight(widths.right);
    bindHandle(leftHandle, "left");
    bindHandle(rightHandle, "right");
  }

  return { bindEvents, applyLeft, applyRight, widths: () => ({ ...widths }) };
}
