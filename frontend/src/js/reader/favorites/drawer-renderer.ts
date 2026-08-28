import { CLIPPING_TAGS } from "./tags.js";
import { showDeleteConfirmation } from "./overlays.js";
import { clearTextSelection } from "./text-selection.js";

export function renderFavorites(listEl, items = [], {
  onLocateFavorite = null,
  onPeekFavoriteEnd = null,
  onPeekFavoriteStart = null,
  onPinFavorite = null,
  onRemoveFavorite = null,
  onUpdateFavorite = null,
} = {}) {
  if (!listEl) {
    return;
  }
  const documentRef = listEl.ownerDocument || globalThis.document;
  const drawer = listEl.closest?.(".reader-favorites-drawer");
  drawer?.classList?.toggle?.("is-populated", Boolean(items.length));
  listEl.replaceChildren();
  if (!items.length) {
    const empty = documentRef.createElement("div");
    empty.className = "reader-favorites-empty empty-state";
    empty.innerHTML = [
      '<div class="empty-state-icon" aria-hidden="true">',
      '<span class="instrument-icon" style="width:36px;height:36px;background-color:currentColor;',
      "-webkit-mask-image:url(src/assets/icons/instruments/instrument-flask.svg);",
      "mask-image:url(src/assets/icons/instruments/instrument-flask.svg);",
      "-webkit-mask-size:contain;mask-size:contain;",
      "-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;",
      "-webkit-mask-position:center;mask-position:center;",
      'display:block"></span></div>',
      '<p class="empty-state-title">Chưa có trích đoạn ảnh chụp</p>',
      '<p class="empty-state-hint">Chọn đoạn văn hoặc biểu đồ rồi bấm "Lưu", trích đoạn sẽ xuất hiện ở đây.</p>',
    ].join("");
    listEl.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const card = documentRef.createElement("button");
    card.className = "reader-favorite-card";
    card.type = "button";
    card.dataset.readerFavoriteId = item.id || "";
    card.addEventListener("click", () => onPinFavorite?.(item));
    card.addEventListener("dblclick", (event) => {
      event.preventDefault?.();
      clearTextSelection(documentRef);
      onPinFavorite?.(item);
    });
    const locateButton = documentRef.createElement("span");
    locateButton.className = "reader-favorite-locate";
    locateButton.role = "button";
    locateButton.tabIndex = 0;
    locateButton.setAttribute("aria-label", "Định vị trích đoạn ảnh chụp");
    locateButton.textContent = "↗";
    let peekStartedAt = 0;
    let isPeeking = false;
    const endPeek = (event) => {
      if (!isPeeking) {
        return;
      }
      event?.preventDefault?.();
      event?.stopPropagation?.();
      isPeeking = false;
      onPeekFavoriteEnd?.(item);
    };
    locateButton.addEventListener("pointerdown", (event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
      peekStartedAt = Date.now();
      isPeeking = true;
      onPeekFavoriteStart?.(item);
    });
    locateButton.addEventListener("pointerup", endPeek);
    locateButton.addEventListener("pointercancel", endPeek);
    locateButton.addEventListener("mouseleave", endPeek);
    locateButton.addEventListener("click", (event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
      const elapsed = peekStartedAt ? Date.now() - peekStartedAt : 0;
      peekStartedAt = 0;
      if (elapsed <= 260) {
        onLocateFavorite?.(item);
      }
    });
    locateButton.addEventListener("dblclick", (event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
    });
    locateButton.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault?.();
      event.stopPropagation?.();
      onLocateFavorite?.(item);
    });
    const removeButton = documentRef.createElement("span");
    removeButton.className = "reader-favorite-remove";
    removeButton.role = "button";
    removeButton.tabIndex = 0;
    removeButton.setAttribute("aria-label", "Xóa trích đoạn ảnh chụp");
    removeButton.textContent = "×";
    const removeFavorite = (event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
      showDeleteConfirmation(removeButton, () => onRemoveFavorite?.(item), documentRef);
    };
    removeButton.addEventListener("click", removeFavorite);
    removeButton.addEventListener("dblclick", (event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
    });
    removeButton.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      removeFavorite(event);
    });
    const preview = documentRef.createElement("span");
    preview.className = "reader-favorite-thumb";
    if (item.previewUrl) {
      const image = documentRef.createElement("img");
      image.src = item.previewUrl;
      image.alt = "";
      preview.appendChild(image);
    }
    const meta = documentRef.createElement("span");
    meta.className = "reader-favorite-card-meta";
    meta.textContent = `Trang ${item.page || "-"}`;
    const editor = documentRef.createElement("span");
    editor.className = "reader-favorite-editor";
    const tagRow = documentRef.createElement("span");
    tagRow.className = "reader-favorite-tags";
    CLIPPING_TAGS.forEach((tag) => {
      const tagButton = documentRef.createElement("span");
      tagButton.className = "reader-favorite-tag";
      tagButton.role = "button";
      tagButton.tabIndex = 0;
      tagButton.dataset.readerTag = tag.value;
      tagButton.dataset.active = item.tag === tag.value ? "true" : "false";
      tagButton.textContent = tag.label;
      const updateTag = (event) => {
        event.preventDefault?.();
        event.stopPropagation?.();
        onUpdateFavorite?.(item.id, { tag: item.tag === tag.value ? "" : tag.value });
      };
      tagButton.addEventListener("click", updateTag);
      tagButton.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        updateTag(event);
      });
      tagRow.appendChild(tagButton);
    });
    editor.append(tagRow);
    card.append(locateButton, removeButton, preview, meta, editor);
    listEl.appendChild(card);
  });
}
