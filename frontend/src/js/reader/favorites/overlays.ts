import { formatRect } from "./geometry.js";
import type {
  AttachSelectionCloseOptions,
  PixelRect,
  ReaderSelection,
} from "../types.js";

export function showDeleteConfirmation(control, onConfirm, documentRef = control?.ownerDocument || globalThis.document) {
  if (!control || typeof onConfirm !== "function") {
    return;
  }
  const host = control.parentNode || control;
  const existing = host.querySelector?.(".reader-delete-popover");
  if (existing) {
    existing.remove?.();
    return;
  }
  host.querySelectorAll?.(".reader-delete-popover")?.forEach?.((node) => node.remove?.());
  const popover = documentRef.createElement("span");
  popover.className = "reader-delete-popover";
  popover.setAttribute?.("role", "dialog");
  popover.setAttribute?.("aria-label", "Xác nhận xóa trích đoạn ảnh chụp");
  popover.addEventListener?.("click", (event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
  });

  const message = documentRef.createElement("span");
  message.className = "reader-delete-popover-text";
  message.textContent = "Xóa?";

  const cancel = documentRef.createElement("button");
  cancel.type = "button";
  cancel.className = "reader-delete-popover-cancel";
  cancel.textContent = "Hủy";
  cancel.addEventListener?.("click", (event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    popover.remove?.();
    control.focus?.();
  });

  const confirm = documentRef.createElement("button");
  confirm.type = "button";
  confirm.className = "reader-delete-popover-confirm";
  confirm.textContent = "Xóa";
  confirm.addEventListener?.("click", (event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    popover.remove?.();
    onConfirm();
  });

  popover.append?.(message, cancel, confirm);
  host.appendChild?.(popover);
  confirm.focus?.();
}

export function createSelectionOverlay(page) {
  const overlay = (page.ownerDocument || globalThis.document).createElement("div");
  overlay.className = "reader-selection-box";
  page.appendChild(overlay);
  return overlay;
}

export function createPinnedOverlay(rootElement, documentRef = rootElement?.ownerDocument || globalThis.document) {
  const overlay = documentRef.createElement("div");
  overlay.className = "reader-selection-box";
  overlay.classList.add("is-pinned");
  if (documentRef?.body?.appendChild) {
    documentRef.body.appendChild(overlay);
  } else {
    rootElement?.appendChild?.(overlay);
  }
  return overlay;
}

export function updateSelectionOverlay(overlay, rect) {
  if (!overlay) {
    return;
  }
  overlay.style.left = `${rect.left}px`;
  overlay.style.top = `${rect.top}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
}

export function attachSelectionClose(overlay, onClose, {
  onCollect = null,
  onLocate = null,
  onPeekEnd = null,
  onPeekStart = null,
}: AttachSelectionCloseOptions = {}) {
  if (!overlay) {
    return;
  }
  const documentRef = overlay.ownerDocument || globalThis.document;
  if (typeof onLocate === "function") {
    const locate = documentRef.createElement("button");
    locate.type = "button";
    locate.className = "reader-selection-locate";
    locate.setAttribute("aria-label", "Định vị trích đoạn ảnh chụp");
    locate.textContent = "↗";
    let peekStartedAt = 0;
    let isPeeking = false;
    const endPeek = (event) => {
      if (!isPeeking) {
        return;
      }
      event?.preventDefault?.();
      event?.stopPropagation?.();
      isPeeking = false;
      onPeekEnd?.();
    };
    locate.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation?.();
      peekStartedAt = Date.now();
      isPeeking = true;
      onPeekStart?.();
    });
    locate.addEventListener("pointerup", endPeek);
    locate.addEventListener("pointercancel", endPeek);
    locate.addEventListener("mouseleave", endPeek);
    locate.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation?.();
      const elapsed = peekStartedAt ? Date.now() - peekStartedAt : 0;
      peekStartedAt = 0;
      if (elapsed <= 260) {
        onLocate?.();
      }
    });
    overlay.appendChild(locate);
  }
  if (typeof onCollect === "function") {
    const collect = documentRef.createElement("button");
    collect.type = "button";
    collect.className = "reader-selection-collect";
    collect.setAttribute("aria-label", "Thu gọn trích đoạn ảnh chụp");
    collect.textContent = "−";
    collect.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation?.();
      onCollect?.();
    });
    overlay.appendChild(collect);
  }
  const close = documentRef.createElement("button");
  close.type = "button";
  close.className = "reader-selection-close";
  close.setAttribute("aria-label", "Xóa trích đoạn ảnh chụp");
  close.textContent = "×";
  close.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation?.();
    showDeleteConfirmation(close, () => onClose?.(), documentRef);
  });
  overlay.appendChild(close);
}

export function setOverlayPreview(overlay, previewUrl = "") {
  if (!overlay) {
    return;
  }
  overlay.querySelector?.(".reader-selection-preview")?.remove?.();
  overlay.classList.add("is-clipping");
  if (!previewUrl) {
    return;
  }
  const documentRef = overlay.ownerDocument || globalThis.document;
  const image = documentRef.createElement("img");
  image.className = "reader-selection-preview";
  image.src = previewUrl;
  image.alt = "";
  overlay.insertBefore?.(image, overlay.firstChild || null);
}

export function selectionSummary(selection: Partial<ReaderSelection> = {}) {
  return `Trang ${selection.page || "-"}, vùng chọn ${formatRect(selection.rect || {})}`;
}

export function showSelectionToast(pageElement, rect: Partial<PixelRect>, message) {
  if (!pageElement || !rect || !message) {
    return;
  }
  const documentRef = pageElement.ownerDocument || globalThis.document;
  pageElement.querySelectorAll(".reader-selection-toast").forEach((element) => element.remove());
  const toast = documentRef.createElement("div");
  toast.className = "reader-selection-toast";
  toast.textContent = message;
  toast.style.left = `${Math.max(18, rect.left + rect.width / 2)}px`;
  toast.style.top = `${Math.max(18, rect.top + 8)}px`;
  pageElement.appendChild(toast);
  globalThis.window?.setTimeout?.(() => {
    toast.classList.add("is-leaving");
  }, 760);
  globalThis.window?.setTimeout?.(() => {
    toast.remove();
  }, 1100);
}

export function showSourceLocator(pageElement, rect: Partial<PixelRect> | null | undefined, message = "Vị trí đã lưu") {
  if (!pageElement || !rect) {
    return;
  }
  const documentRef = pageElement.ownerDocument || globalThis.document;
  pageElement.querySelectorAll(".reader-selection-locator").forEach((element) => element.remove());
  const locator = documentRef.createElement("div");
  locator.className = "reader-selection-locator";
  locator.style.left = `${rect.left}px`;
  locator.style.top = `${rect.top}px`;
  locator.style.width = `${rect.width}px`;
  locator.style.height = `${rect.height}px`;
  const label = documentRef.createElement("span");
  label.textContent = message;
  locator.appendChild(label);
  pageElement.appendChild(locator);
  globalThis.window?.setTimeout?.(() => {
    locator.classList.add("is-leaving");
  }, 1400);
  globalThis.window?.setTimeout?.(() => {
    locator.remove();
  }, 1900);
}
