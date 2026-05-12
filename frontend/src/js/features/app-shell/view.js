import { $ } from "../../dom.js";

export function bindDialogBackdropClose(id) {
  const dialog = $(id);
  if (!dialog) {
    return;
  }
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
}

export function closeInfoBubbles(except = null) {
  document.querySelectorAll(".developer-hint.is-open").forEach((node) => {
    if (node !== except) {
      node.classList.remove("is-open");
    }
  });
}

export function bindInfoBubbles() {
  document.querySelectorAll(".developer-hint").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = !trigger.classList.contains("is-open");
      closeInfoBubbles(trigger);
      trigger.classList.toggle("is-open", willOpen);
    });
  });

  document.addEventListener("click", () => {
    closeInfoBubbles();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeInfoBubbles();
    }
  });
}

export function bindUploadTilePicker(prepareFilePicker) {
  document.querySelector(".upload-tile")?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.closest("button") || target.closest("a") || target.closest("input")) {
      return;
    }
    const fileInput = $("file");
    if (!fileInput || fileInput.disabled) {
      return;
    }
    fileInput.click();
  });

  $("file")?.addEventListener("click", prepareFilePicker);
}

export function resetEventsList() {
  $("events-empty")?.classList.remove("hidden");
  $("events-list")?.classList.add("hidden");
  if ($("events-list")) {
    $("events-list").innerHTML = "";
  }
}

export function closeRuntimeDialogs() {
  $("status-detail-dialog")?.close();
  $("page-range-dialog")?.close();
}

export function isReaderDialogOpen() {
  return Boolean($("reader-dialog")?.open);
}

export function setCancelButtonDisabled(disabled) {
  const button = $("cancel-btn");
  if (button) {
    button.disabled = !!disabled;
  }
}
