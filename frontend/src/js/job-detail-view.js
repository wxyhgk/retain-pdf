import { $ } from "./dom.js";

const DETAIL_MODAL_IDS = [
  "detail-stage-history-modal",
  "detail-events-modal",
];

export function setDetailText(id, value) {
  const el = $(id);
  if (el) {
    el.textContent = value ?? "-";
  }
}

export function setDetailActionLink(id, url, enabled) {
  const el = $(id);
  if (!el) {
    return;
  }
  el.href = enabled && url ? url : "#";
  el.classList.toggle("disabled", !enabled);
  el.setAttribute("aria-disabled", enabled ? "false" : "true");
}

export function setDetailModalOpen(modalId, open) {
  const modal = $(modalId);
  if (!modal) {
    return;
  }
  modal.classList.toggle("hidden", !open);
  modal.setAttribute("aria-hidden", open ? "false" : "true");
  const hasOpenModal = DETAIL_MODAL_IDS.some((id) => !$(id)?.classList.contains("hidden"));
  document.body.style.overflow = hasOpenModal ? "hidden" : "";
}

export function bindDetailModalDismiss(modalId, closeButtonId) {
  $(closeButtonId)?.addEventListener("click", () => {
    setDetailModalOpen(modalId, false);
  });
  $(modalId)?.addEventListener("click", (event) => {
    if (event.target === $(modalId)) {
      setDetailModalOpen(modalId, false);
    }
  });
}

export function closeAllDetailModals() {
  DETAIL_MODAL_IDS.forEach((id) => {
    setDetailModalOpen(id, false);
  });
}

export function setDetailEventsStatus(text) {
  const status = $("detail-events-status");
  if (status) {
    status.textContent = text;
  }
}

export function setDetailOpenEventsButtonText(text) {
  const button = $("detail-open-events-btn");
  if (button) {
    button.textContent = text;
  }
}
