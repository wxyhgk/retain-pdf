import { createReaderFavoritesStore } from "./favorites-storage.js";
import {
  pageNumberOfElement,
} from "./page-geometry.js";
import { isReaderTranslatedRegionEvent, jumpToReaderAnchor } from "./region-interactions.js";
import { copyText } from "../utils/clipboard.js";
import { renderFavorites } from "./favorites/drawer-renderer.js";
import { renderServerFavorites } from "./favorites/server-drawer-renderer.js";
import { dedupeServerFavorites } from "./server-favorites-port.js";
import {
  clampRect,
  clampScale,
  rectFromRelative,
  rectFromViewportRelative,
  relativeRect,
  viewportRelativeRect,
} from "./favorites/geometry.js";
import {
  attachSelectionClose,
  createPinnedOverlay,
  createSelectionOverlay,
  selectionSummary,
  setOverlayPreview,
  showSelectionToast,
  showSourceLocator,
  updateSelectionOverlay,
} from "./favorites/overlays.js";
import { captureSelectionPreview } from "./favorites/preview.js";
import { clearTextSelection } from "./favorites/text-selection.js";
import type {
  ClearActiveSelectionOptions,
  CreateReaderSelectionFavoritesOptions,
  FavoriteItem,
  FavoriteMetadataPatch,
  FavoriteSelectionOptions,
  PixelRect,
  ReaderPositionSnapshot,
  ReaderSelection,
  ServerFavorite,
  SyncDrawerOptions,
} from "./types.js";

function selectionId() {
  return `fav-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function findPageFromEvent(event, root) {
  const page = event.target?.closest?.(".page[data-page-number]");
  if (!page || !root?.contains?.(page)) {
    return null;
  }
  return page;
}

function saveStoredSelection(store, selection) {
  if (!selection?.id || !store?.save) {
    return;
  }
  const items = store.list();
  store.save(items.map((item) => {
    if (item.id !== selection.id) {
      return item;
    }
    return {
      ...item,
      rect: selection.rect,
      anchorRect: selection.anchorRect,
      baseRect: selection.baseRect,
      relativeRect: selection.relativeRect,
      anchorRelativeRect: selection.anchorRelativeRect,
      scale: selection.scale,
      note: selectionSummary(selection),
    };
  }));
}

function findPageElement(root, pageNumber) {
  if (!root || !pageNumber) {
    return null;
  }
  return root.querySelector?.(`.page[data-page-number="${pageNumber}"]`) || null;
}

function paneFromPage(pageElement) {
  const pane = pageElement?.closest?.("[data-reader-pane]")?.dataset?.readerPane || "";
  return ["source", "translated"].includes(pane) ? pane : "";
}

function normalizeReaderMode(mode) {
  return ["source", "translated", "compare"].includes(mode) ? mode : "";
}

function visibleModeForPane(pane, fallbackMode = "compare") {
  const mode = normalizeReaderMode(fallbackMode) || "compare";
  if (mode === "compare") {
    return "compare";
  }
  return ["source", "translated"].includes(pane) ? pane : mode;
}

function findPageElementForSelection(root, selection: Partial<ReaderSelection | FavoriteItem> = {}) {
  if (!root || !selection.page) {
    return null;
  }
  if (selection.pane) {
    return root.querySelector?.(`[data-reader-pane="${selection.pane}"] .page[data-page-number="${selection.page}"]`) || null;
  }
  return findPageElement(root, selection.page);
}

function centerSelectionInScrollShell(root, pageElement, rect: Partial<PixelRect> = {}) {
  const pageRect = pageElement?.getBoundingClientRect?.();
  const rootRect = root?.getBoundingClientRect?.();
  const viewportHeight = Number(root?.clientHeight) || Number(rootRect?.height) || 0;
  const viewportWidth = Number(root?.clientWidth) || Number(rootRect?.width) || 0;
  if (!root || !pageRect || !rootRect || !viewportHeight) {
    pageElement?.scrollIntoView?.({ block: "center", inline: "center", behavior: "auto" });
    return;
  }
  const currentTop = Number(root.scrollTop) || 0;
  const currentLeft = Number(root.scrollLeft) || 0;
  const selectionCenterTop = currentTop + (pageRect.top - rootRect.top) + (Number(rect.top) || 0) + (Number(rect.height) || 0) / 2;
  const selectionCenterLeft = currentLeft + (pageRect.left - rootRect.left) + (Number(rect.left) || 0) + (Number(rect.width) || 0) / 2;
  const maxTop = Math.max(0, (Number(root.scrollHeight) || 0) - viewportHeight);
  const maxLeft = Math.max(0, (Number(root.scrollWidth) || 0) - viewportWidth);
  const top = Math.max(0, Math.min(maxTop || selectionCenterTop, selectionCenterTop - viewportHeight / 2));
  const left = viewportWidth
    ? Math.max(0, Math.min(maxLeft || selectionCenterLeft, selectionCenterLeft - viewportWidth / 2))
    : currentLeft;
  if (root.scrollTo) {
    root.scrollTo({ left, top, behavior: "auto" });
    return;
  }
  root.scrollLeft = left;
  root.scrollTop = top;
}

export function createReaderSelectionFavorites({
  documentRef = globalThis.document,
  jobId = "",
  drawerController = null,
  root = documentRef?.getElementById?.("reader-scroll-shell"),
  setReaderMode = null,
  store = createReaderFavoritesStore({ jobId }),
  resolveQuote = null,
  serverFavoritesPort = null,
  jumpToAnchor = jumpToReaderAnchor,
}: CreateReaderSelectionFavoritesOptions = {}) {
  let enabled = true;
  let dragState = null;
  let moveState = null;
  let peekState: ReaderPositionSnapshot | null = null;
  let activeSelection: ReaderSelection | null = null;
  let serverFavorites: ServerFavorite[] = [];
  const pinnedSelections = new Map<string, ReaderSelection>();
  const listEl = documentRef?.getElementById?.("reader-favorites-list");
  const actionLayer = documentRef?.createElement?.("div");

  if (actionLayer) {
    actionLayer.className = "reader-selection-action-layer";
  }

  function syncDrawer({ preserveScroll = false }: SyncDrawerOptions = {}) {
    const scrollTop = preserveScroll ? listEl?.scrollTop || 0 : 0;
    const scrollLeft = preserveScroll ? listEl?.scrollLeft || 0 : 0;
    renderFavorites(listEl, store.list(), {
      onLocateFavorite: locateFavorite,
      onPeekFavoriteEnd: endPeekFavorite,
      onPeekFavoriteStart: beginPeekFavorite,
      onPinFavorite: pinFavorite,
      onRemoveFavorite: removeFavorite,
      onUpdateFavorite: updateFavoriteMetadata,
    });
    // renderFavorites chỉ chuyển đổi is-populated theo mục địa phương, khu vực Yêu thích đám mây sẽ sửa đồng bộ sau
    renderServerSection();
    if (preserveScroll && listEl) {
      listEl.scrollTop = scrollTop;
      listEl.scrollLeft = scrollLeft;
    }
  }

  // ===== Khu vực Yêu thích đám mây (favorites từ máy chủ, chia sẻ không gian với trích dẫn ảnh cục bộ) =====

  function ensureServerSectionEl() {
    if (!listEl) {
      return null;
    }
    const drawer = listEl.closest?.(".reader-favorites-drawer") || listEl.parentNode;
    if (!drawer) {
      return null;
    }
    let section = drawer.querySelector?.(".reader-favorite-server-section");
    if (!section && documentRef?.createElement) {
      section = documentRef.createElement("div");
      section.className = "reader-favorite-server-section is-empty";
      if (listEl.insertAdjacentElement) {
        listEl.insertAdjacentElement("afterend", section);
      } else {
        drawer.appendChild(section);
      }
    }
    return section || null;
  }

  function renderServerSection() {
    const section = ensureServerSectionEl();
    if (!section) {
      return;
    }
    // Bản ghi cục bộ đã đồng bộ với serverFavoriteId sẽ không hiển thị trùng trong khu vực Yêu thích đám mây
    const records = dedupeServerFavorites(serverFavorites, store.list());
    renderServerFavorites(section, records, {
      onOpenFavorite: (record) => {
        jumpToAnchor?.({ pageIdx: record.pageIdx, blockId: record.blockId });
      },
      onRemoveFavorite: (record) => {
        void removeServerFavoriteRecord(record);
      },
    });
    const drawer = section.closest?.(".reader-favorites-drawer");
    drawer?.classList?.toggle?.("is-populated", Boolean(store.list().length || records.length));
  }

  async function refreshServerFavorites() {
    if (!serverFavoritesPort?.loadServerFavorites) {
      return;
    }
    try {
      serverFavorites = await serverFavoritesPort.loadServerFavorites() || [];
    } catch (error) {
      console.warn("Không thể tải Yêu thích từ máy chủ", error);
      serverFavorites = [];
    }
    renderServerSection();
  }

  async function removeServerFavoriteRecord(record: Partial<ServerFavorite> = {}) {
    if (!serverFavoritesPort?.removeServerFavorite) {
      return;
    }
    const removed = await serverFavoritesPort.removeServerFavorite(record.favoriteId);
    if (removed) {
      serverFavorites = serverFavorites.filter((item) => item.favoriteId !== record.favoriteId);
    }
    renderServerSection();
  }

  // Xóa cục bộ có hiệu lực ngay lập tức; nếu bản ghi đã đồng bộ với máy chủ, cũng xóa Yêu thích đám mây (cố gắng hết sức).
  function deleteStoredFavorite(id) {
    if (!id || !store?.save) {
      return;
    }
    const items = store.list();
    const removedItem = items.find((item) => item.id === id) || null;
    store.save(items.filter((item) => item.id !== id));
    const serverFavoriteId = `${removedItem?.serverFavoriteId || ""}`.trim();
    if (serverFavoriteId && serverFavoritesPort?.removeServerFavorite) {
      void serverFavoritesPort.removeServerFavorite(serverFavoriteId)
        .then(() => refreshServerFavorites())
        .catch((error) => console.warn("Không thể xóa Yêu thích từ máy chủ", error));
    }
  }

  function updateFavoriteMetadata(id: string, patch: FavoriteMetadataPatch = {}) {
    if (!id || !store?.save) {
      return;
    }
    store.save(store.list().map((item) => {
      if (item.id !== id) {
        return item;
      }
      return {
        ...item,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
    }));
    syncDrawer({ preserveScroll: true });
  }

  function releasePointerTracking() {
    documentRef?.removeEventListener?.("mousemove", moveSelection);
    documentRef?.removeEventListener?.("mouseup", finishSelection);
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
  }

  function clearActiveSelection({ removeOverlay = false }: ClearActiveSelectionOptions = {}) {
    if (removeOverlay) {
      activeSelection?.overlay?.remove?.();
      if (activeSelection?.id) {
        pinnedSelections.delete(activeSelection.id);
      }
    }
    actionLayer?.replaceChildren?.();
    activeSelection = null;
  }

  function removePinnedSelection(selection = activeSelection) {
    if (!selection) {
      return;
    }
    selection.overlay?.remove?.();
    if (selection.id) {
      pinnedSelections.delete(selection.id);
      deleteStoredFavorite(selection.id);
      syncDrawer();
    }
    if (activeSelection === selection || activeSelection?.id === selection.id) {
      activeSelection = null;
      actionLayer?.replaceChildren?.();
    }
  }

  function removeFavorite(item: Partial<FavoriteItem> = {}) {
    const id = item.id || "";
    if (!id || !store?.save) {
      return;
    }
    const pinnedSelection = pinnedSelections.get(id);
    pinnedSelection?.overlay?.remove?.();
    pinnedSelections.delete(id);
    deleteStoredFavorite(id);
    if (activeSelection?.id === id) {
      activeSelection = null;
      actionLayer?.replaceChildren?.();
    }
    syncDrawer({ preserveScroll: true });
  }

  function snapshotReaderPosition() {
    return {
      mode: documentRef?.body?.dataset?.readerMode || "compare",
      scrollLeft: Number(root?.scrollLeft) || 0,
      scrollTop: Number(root?.scrollTop) || 0,
    };
  }

  function restoreReaderPosition(snapshot = null) {
    if (!snapshot) {
      return;
    }
    if (snapshot.mode && documentRef?.body?.dataset?.readerMode !== snapshot.mode) {
      setReaderMode?.(snapshot.mode);
      if (documentRef?.body?.dataset) {
        documentRef.body.dataset.readerMode = snapshot.mode;
      }
    }
    if (root?.scrollTo) {
      root.scrollTo({ left: snapshot.scrollLeft, top: snapshot.scrollTop, behavior: "auto" });
      return;
    }
    if (root) {
      root.scrollLeft = snapshot.scrollLeft;
      root.scrollTop = snapshot.scrollTop;
    }
  }

  function activateSelection(selection) {
    activeSelection = selection;
    return selection;
  }

  function collectSelection(selection = activeSelection) {
    if (!selection) {
      return;
    }
    selection.overlay?.remove?.();
    if (selection.id) {
      pinnedSelections.delete(selection.id);
    }
    if (activeSelection === selection || activeSelection?.id === selection.id) {
      activeSelection = null;
      actionLayer?.replaceChildren?.();
    }
    drawerController?.open?.("favorites");
  }

  function resizePinnedSelection(selection, nextScale, centerX, centerY) {
    if (!selection?.baseRect) {
      return;
    }
    const scale = clampScale(nextScale);
    const previousRect = selection.rect;
    const ratioX = previousRect.width ? (centerX - previousRect.left) / previousRect.width : 0.5;
    const ratioY = previousRect.height ? (centerY - previousRect.top) / previousRect.height : 0.5;
    const nextWidth = Math.max(8, selection.baseRect.width * scale);
    const nextHeight = Math.max(8, selection.baseRect.height * scale);
    const viewportWidth = Number(globalThis.window?.innerWidth) || Number(root?.getBoundingClientRect?.()?.width) || nextWidth;
    const viewportHeight = Number(globalThis.window?.innerHeight) || Number(root?.getBoundingClientRect?.()?.height) || nextHeight;
    const nextLeft = Math.max(0, Math.min(viewportWidth - nextWidth, centerX - nextWidth * ratioX));
    const nextTop = Math.max(0, Math.min(viewportHeight - nextHeight, centerY - nextHeight * ratioY));
    selection.scale = scale;
    selection.rect = { left: nextLeft, top: nextTop, width: nextWidth, height: nextHeight };
    selection.anchorRect = selection.rect;
    selection.anchorRelativeRect = viewportRelativeRect(selection.anchorRect, root);
    updateSelectionOverlay(selection.overlay, selection.rect);
    saveStoredSelection(store, selection);
    syncDrawer();
  }

  function beginPinnedMove(event, selection) {
    if (!selection || event.button !== 0 || event.detail > 1) {
      return false;
    }
    if (event.target?.closest?.(".reader-selection-close")) {
      return false;
    }
    event.preventDefault?.();
    event.stopPropagation?.();
    activateSelection(selection);
    moveState = {
      selection,
      offsetX: event.clientX - selection.rect.left,
      offsetY: event.clientY - selection.rect.top,
    };
    documentRef?.addEventListener?.("mousemove", moveSelection);
    documentRef?.addEventListener?.("mouseup", finishSelection);
    return true;
  }

  function bindPinnedOverlay(overlay, selection) {
    overlay.addEventListener?.("mousedown", (event) => {
      beginPinnedMove(event, selection);
    });
    overlay.addEventListener?.("dblclick", (event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
      clearTextSelection(documentRef);
      collectSelection(selection);
    });
    overlay.addEventListener?.("click", () => activateSelection(selection));
    overlay.addEventListener?.("wheel", (event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
      const nextScale = clampScale((selection.scale || 1) * (event.deltaY < 0 ? 1.08 : 1 / 1.08));
      resizePinnedSelection(selection, nextScale, event.clientX, event.clientY);
    }, { passive: false });
    attachSelectionClose(overlay, () => removePinnedSelection(selection), {
      onCollect: () => collectSelection(selection),
      onLocate: () => locateFavorite(selection),
      onPeekEnd: () => endPeekFavorite(),
      onPeekStart: () => beginPeekFavorite(selection),
    });
  }

  function setActiveSelection(selection: Partial<ReaderSelection & FavoriteItem> = {}) {
    if (selection.id && pinnedSelections.has(selection.id)) {
      return activateSelection(pinnedSelections.get(selection.id));
    }
    const pageElement = selection.pageElement || findPageElementForSelection(root, selection);
    if (!pageElement) {
      return null;
    }
    const sourceRect = selection.sourceRect || selection.rect || rectFromRelative(selection.relativeRect, pageElement);
    const anchorRect = selection.anchorRect || rectFromViewportRelative(selection.anchorRelativeRect, root) || (() => {
      if (!sourceRect) {
        return null;
      }
      const pageRect = pageElement.getBoundingClientRect?.();
      if (!pageRect) {
        return null;
      }
      return {
        left: pageRect.left + sourceRect.left,
        top: pageRect.top + sourceRect.top,
        width: sourceRect.width,
        height: sourceRect.height,
      };
    })();
    if (!sourceRect || !anchorRect) {
      return null;
    }
    const baseRect = selection.baseRect || {
      left: anchorRect.left,
      top: anchorRect.top,
      width: sourceRect.width,
      height: sourceRect.height,
    };
    const scale = clampScale(selection.scale || (baseRect.width ? anchorRect.width / baseRect.width : 1));
    const resolved: ReaderSelection = { ...selection, rect: anchorRect, sourceRect, anchorRect, baseRect, scale };
    const overlay = createPinnedOverlay(root, documentRef);
    overlay.classList.add("is-final", "is-restored");
    updateSelectionOverlay(overlay, resolved.rect);
    setOverlayPreview(overlay, resolved.previewUrl);
    const nextSelection: ReaderSelection = {
      id: resolved.id || selectionId(),
      mode: resolved.mode || documentRef?.body?.dataset?.readerMode || "compare",
      overlay,
      page: resolved.page,
      pane: resolved.pane || paneFromPage(pageElement),
      pageElement,
      rect: resolved.rect,
      anchorRect: resolved.anchorRect,
      baseRect: resolved.baseRect,
      sourceRect,
      scale: resolved.scale,
      relativeRect: resolved.relativeRect || relativeRect(sourceRect, pageElement),
      anchorRelativeRect: resolved.anchorRelativeRect || viewportRelativeRect(anchorRect, root),
      previewUrl: resolved.previewUrl || "",
    };
    overlay.dataset.readerSelectionId = nextSelection.id;
    pinnedSelections.set(nextSelection.id, nextSelection);
    bindPinnedOverlay(overlay, nextSelection);
    return activateSelection(nextSelection);
  }

  function resolveFavoritePage(item: Partial<FavoriteItem | ReaderSelection> = {}) {
    const targetMode = visibleModeForPane(item.pane, item.mode || documentRef?.body?.dataset?.readerMode || "compare");
    if (targetMode !== "compare" && documentRef?.body?.dataset?.readerMode !== targetMode) {
      setReaderMode?.(targetMode);
    }
    const pageElement = item.pageElement || findPageElementForSelection(root, item);
    if (!pageElement) {
      return null;
    }
    return pageElement;
  }

  function locateFavorite(item: Partial<FavoriteItem | ReaderSelection> = {}) {
    const pageElement = resolveFavoritePage(item);
    if (!pageElement) {
      return null;
    }
    const sourceRect = item.sourceRect || item.rect || rectFromRelative(item.relativeRect, pageElement);
    centerSelectionInScrollShell(root, pageElement, sourceRect);
    showSourceLocator(pageElement, sourceRect, "Vị trí Yêu thích");
    return pageElement;
  }

  function beginPeekFavorite(item: Partial<FavoriteItem | ReaderSelection> = {}) {
    if (peekState) {
      return;
    }
    peekState = snapshotReaderPosition();
    locateFavorite(item);
  }

  function endPeekFavorite() {
    const snapshot = peekState;
    peekState = null;
    restoreReaderPosition(snapshot);
  }

  function pinFavorite(item: Partial<FavoriteItem | ReaderSelection> = {}) {
    const pageElement = item.pageElement || findPageElementForSelection(root, item);
    if (!pageElement) {
      return null;
    }
    const selection = setActiveSelection({ ...item, pageElement });
    syncDrawer();
    return selection;
  }

  function favoriteSelection(selection = activeSelection, { openDrawer = true }: FavoriteSelectionOptions = {}) {
    if (!selection) {
      return [];
    }
    const item = {
      id: selection.id || selectionId(),
      kind: "clipping",
      mode: selection.mode,
      page: selection.page,
      pane: selection.pane || paneFromPage(selection.pageElement),
      rect: selection.rect,
      anchorRect: selection.anchorRect || selection.rect,
      baseRect: selection.baseRect || {
        left: selection.rect.left,
        top: selection.rect.top,
        width: selection.sourceRect?.width || selection.rect.width,
        height: selection.sourceRect?.height || selection.rect.height,
      },
      sourceRect: selection.sourceRect || selection.rect,
      scale: clampScale(selection.scale || 1),
      relativeRect: selection.relativeRect || relativeRect(selection.sourceRect || selection.rect, selection.pageElement),
      anchorRelativeRect: selection.anchorRelativeRect || viewportRelativeRect(selection.anchorRect || selection.rect, root),
      previewUrl: selection.previewUrl || captureSelectionPreview(selection),
      title: "Trích dẫn ảnh chụp",
      note: selectionSummary(selection),
      pinned: true,
      createdAt: new Date().toISOString(),
    };
    selection.id = item.id;
    selection.previewUrl = item.previewUrl;
    setOverlayPreview(selection.overlay, item.previewUrl);
    pinnedSelections.set(selection.id, selection);
    const nextItems = store.add(item);
    // Trích xuất vùng chọn: khi trúng vùng gốc, đồng bộ trích dẫn với Yêu thích máy chủ (nếu quote trống thì chỉ lưu cục bộ)
    if (resolveQuote && serverFavoritesPort) {
      const quote = resolveQuote({
        page: selection.page,
        rect: selection.sourceRect || selection.rect,
      });
      if (quote) {
        // Sau khi đồng bộ thành công, ghi lại favorite_id vào bản ghi cục bộ, việc xóa cục bộ sau này có thể xóa liên kết đám mây,
        // khu vực Yêu thích đám mây cũng dựa vào đây để loại trùng, không hiển thị trùng lặp cùng một Yêu thích.
        void serverFavoritesPort.syncFavorite(quote).then((favorite) => {
          const favoriteId = `${favorite?.favorite_id || ""}`.trim();
          if (!favoriteId || !store?.save) {
            return;
          }
          store.save(store.list().map((stored) => (
            stored.id === item.id ? { ...stored, serverFavoriteId: favoriteId } : stored
          )));
          void refreshServerFavorites();
        }).catch((error) => console.warn("Không thể đồng bộ Yêu thích với máy chủ", error));
      }
    }
    syncDrawer();
    showSelectionToast(selection.pageElement, selection.rect, "Đã ghim");
    if (openDrawer) {
      drawerController?.open?.("favorites");
    }
    return nextItems;
  }

  async function copySelection(selection = activeSelection) {
    if (!selection) {
      return;
    }
    await copyText(selectionSummary(selection));
    showSelectionToast(selection.pageElement, selection.rect, "Đã sao chép");
  }

  function showSelectionActions() {}

  function beginSelection(event) {
    if (!enabled || event.button !== 0) {
      return;
    }
    if (event.detail > 1) {
      return;
    }
    if (event.target?.closest?.(".reader-selection-close")) {
      return;
    }
    const overlay = event.target?.closest?.(".reader-selection-box");
    if (overlay?.dataset?.readerSelectionId) {
      const selection = pinnedSelections.get(overlay.dataset.readerSelectionId);
      if (beginPinnedMove(event, selection)) {
        return;
      }
    }
    if (isReaderTranslatedRegionEvent(event)) {
      return;
    }
    const page = findPageFromEvent(event, root);
    if (!page) {
      return;
    }
    event.preventDefault();
    const pageRect = page.getBoundingClientRect();
    const startX = event.clientX - pageRect.left;
    const startY = event.clientY - pageRect.top;
    dragState = {
      page,
      pageNumber: pageNumberOfElement(page),
      overlay: createSelectionOverlay(page),
      startX,
      startY,
      endX: startX,
      endY: startY,
    };
    updateSelectionOverlay(dragState.overlay, clampRect(dragState));
    documentRef?.addEventListener?.("mousemove", moveSelection);
    documentRef?.addEventListener?.("mouseup", finishSelection);
  }

  function moveSelection(event) {
    if (moveState?.selection) {
      event.preventDefault();
      const { selection, offsetX, offsetY } = moveState;
      const viewportWidth = Number(globalThis.window?.innerWidth) || Number(root?.getBoundingClientRect?.()?.width) || selection.rect.width;
      const viewportHeight = Number(globalThis.window?.innerHeight) || Number(root?.getBoundingClientRect?.()?.height) || selection.rect.height;
      const nextLeft = Math.max(0, Math.min(
        viewportWidth - selection.rect.width,
        event.clientX - offsetX,
      ));
      const nextTop = Math.max(0, Math.min(
        viewportHeight - selection.rect.height,
        event.clientY - offsetY,
      ));
      selection.rect = { ...selection.rect, left: nextLeft, top: nextTop };
      selection.anchorRect = selection.rect;
      selection.anchorRelativeRect = viewportRelativeRect(selection.anchorRect, root);
      updateSelectionOverlay(selection.overlay, selection.rect);
      return;
    }
    if (!dragState) {
      return;
    }
    event.preventDefault();
    const pageRect = dragState.page.getBoundingClientRect();
    dragState.endX = event.clientX - pageRect.left;
    dragState.endY = event.clientY - pageRect.top;
    updateSelectionOverlay(dragState.overlay, clampRect(dragState));
  }

  function finishSelection(event?: MouseEvent | Event | null) {
    if (moveState?.selection) {
      event?.preventDefault?.();
      saveStoredSelection(store, moveState.selection);
      syncDrawer();
      moveState = null;
      releasePointerTracking();
      return;
    }
    if (!dragState) {
      return;
    }
    event?.preventDefault?.();
    const rect = clampRect(dragState);
    const validSelection = rect.width >= 8 && rect.height >= 8;
    if (validSelection) {
      const mode = documentRef?.body?.dataset?.readerMode || "compare";
      const sourceRect = rect;
      const pageRect = dragState.page.getBoundingClientRect?.();
      const anchorRect = {
        left: (pageRect?.left || 0) + sourceRect.left,
        top: (pageRect?.top || 0) + sourceRect.top,
        width: sourceRect.width,
        height: sourceRect.height,
      };
      const selectionOverlay = dragState.overlay;
      activeSelection = {
        id: selectionId(),
        mode,
        page: dragState.pageNumber,
        pane: paneFromPage(dragState.page),
        pageElement: dragState.page,
        rect: anchorRect,
        anchorRect,
        baseRect: anchorRect,
        sourceRect,
        scale: 1,
        relativeRect: relativeRect(sourceRect, dragState.page),
        anchorRelativeRect: viewportRelativeRect(anchorRect, root),
      };
      selectionOverlay?.remove?.();
      activeSelection.overlay = createPinnedOverlay(root, documentRef);
      activeSelection.overlay.dataset.readerSelectionId = activeSelection.id;
      activeSelection.overlay.classList.add("is-final");
      updateSelectionOverlay(activeSelection.overlay, activeSelection.rect);
      bindPinnedOverlay(activeSelection.overlay, activeSelection);
      pinnedSelections.set(activeSelection.id, activeSelection);
      favoriteSelection(activeSelection, { openDrawer: false });
    } else {
      dragState.overlay?.remove?.();
    }
    dragState = null;
    releasePointerTracking();
    syncDrawer();
  }

  function bindEvents() {
    if (actionLayer && root && !actionLayer.parentNode) {
      root.appendChild(actionLayer);
    }
    syncDrawer();
    root?.addEventListener?.("mousedown", beginSelection);
    root?.addEventListener?.("mousemove", moveSelection);
    root?.addEventListener?.("mouseup", finishSelection);
    root?.addEventListener?.("mouseleave", () => {
      if (!dragState && !moveState) {
        finishSelection(undefined);
      }
    });
    root?.addEventListener?.("scroll", () => {
      activeSelection = activeSelection || null;
    });
    syncDrawer();
    // bindEvents được gọi sau khi tải xong regions, lúc này lấy thu thập từ máy chủ để điền vào khu vực đám mây
    void refreshServerFavorites();
  }

  return {
    bindEvents,
    clearActiveSelection,
    copySelection,
    favoriteSelection,
    refreshServerFavorites,
    setEnabled,
    syncDrawer,
    openFavorite: pinFavorite,
  };
}
