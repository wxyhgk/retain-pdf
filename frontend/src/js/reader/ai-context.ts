import type {
  CreateReaderAiContextOptions,
  ReaderAiScope,
  ReaderAiSelectionContext,
  ReaderSelection,
} from "./types.js";

function formatSelection(selection: ReaderAiSelectionContext | ReaderSelection = {}) {
  const rect = selection.rect || {};
  const width = Math.round(Number(rect.width || 0));
  const height = Math.round(Number(rect.height || 0));
  return `Trang ${selection.page || "-"} · ${width} × ${height}`;
}

export function createReaderAiContext({
  documentRef = globalThis.document,
  drawerController = null,
}: CreateReaderAiContextOptions = {}) {
  const scopeButtons = Array.from(
    documentRef?.querySelectorAll?.("[data-reader-ai-scope]") || [],
  ) as HTMLElement[];
  const contextEl = documentRef?.getElementById?.("reader-ai-context");
  let scope: ReaderAiScope = "document";
  let selection: ReaderAiSelectionContext | ReaderSelection | null = null;

  function sync() {
    scopeButtons.forEach((button) => {
      const active = button.dataset.readerAiScope === scope;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (!contextEl) {
      return;
    }
    if (scope === "selection" && selection) {
      contextEl.textContent = `Vùng chọn hiện tại: ${formatSelection(selection)}`;
      return;
    }
    if (scope === "page" && selection?.page) {
      contextEl.textContent = `Trang hiện tại: Trang ${selection.page}`;
      return;
    }
    contextEl.textContent = "Phạm vi hiện tại: Toàn bộ tài liệu";
  }

  function setScope(nextScope: string) {
    scope = ["document", "page", "selection"].includes(nextScope)
      ? (nextScope as ReaderAiScope)
      : "document";
    sync();
    return scope;
  }

  function useSelection(nextSelection: ReaderAiSelectionContext | ReaderSelection = {}) {
    selection = nextSelection;
    setScope("selection");
    drawerController?.open?.("ai");
    return selection;
  }

  function bindEvents() {
    scopeButtons.forEach((button) => {
      button.addEventListener("click", () => setScope(button.dataset.readerAiScope || "document"));
    });
    sync();
  }

  return {
    bindEvents,
    context: () => selection,
    scope: () => scope,
    setScope,
    useSelection,
  };
}
