import {
  copyTextToClipboard,
  escapeHtml,
  firstText,
} from "./region-utils.js";

export function removeReaderMarkdownPopover() {
  document.querySelector("#reader-region-markdown-popover")?.remove();
}

export function formatReaderRegionMarkdownPayload(payload) {
  const item = payload?.item || payload || {};
  const markdown = firstText(
    payload?.markdown,
    item.markdown,
    item.markdown_text,
    item.markdown_source,
    item.protected_markdown,
    item.render_markdown,
    item.typst_markdown,
  );
  const translated = firstText(
    payload?.translated?.text,
    payload?.translated_text,
    item.translated_text,
    item.translation_unit_translated_text,
    item.group_translated_text,
    item.protected_translated_text,
    item.translation_unit_protected_translated_text,
    item.group_protected_translated_text,
  );
  const source = firstText(payload?.source?.text, payload?.source_text, item.source_text, item.text, item.raw_text);
  return {
    title: firstText(payload?.item_id, item.item_id, "mục dịch thuật"),
    primaryLabel: markdown ? "Markdown" : (translated ? "Bản dịch" : "Nguồn"),
    primaryText: markdown || translated || source || "Vùng này tạm thời không có văn bản hiển thị",
    source,
    translated,
  };
}

function renderReaderTextBlock(label, text) {
  const normalized = `${text || ""}`;
  if (!normalized.trim()) {
    return "";
  }
  return `
    <section class="reader-region-markdown-section">
      <div class="reader-region-markdown-label-row">
        <span class="reader-region-markdown-label">${escapeHtml(label)}</span>
        <button type="button" class="reader-region-copy-btn" data-copy-text="${escapeHtml(normalized)}">Sao chép</button>
      </div>
      <pre>${escapeHtml(normalized)}</pre>
    </section>
  `;
}

async function copyReaderRegionText(button) {
  const text = button?.dataset?.copyText || "";
  if (!text) {
    return;
  }
    try {
      await copyTextToClipboard(text);
      const previous = button.textContent;
      button.textContent = "Đã sao chép";
      window.setTimeout(() => {
        button.textContent = previous || "Sao chép";
      }, 900);
    } catch {
      button.textContent = "Sao chép thất bại";
      window.setTimeout(() => {
        button.textContent = "Sao chép";
      }, 900);
    }
}

function positionReaderMarkdownPopover(popover, event) {
  const margin = 12;
  const width = Math.min(360, window.innerWidth - margin * 2);
  popover.style.width = `${Math.max(220, width)}px`;
  popover.style.left = `${Math.min(event.clientX + 10, window.innerWidth - width - margin)}px`;
  popover.style.top = `${Math.min(event.clientY + 10, window.innerHeight - 180)}px`;
}

export function renderReaderMarkdownPopover(event, region, state) {
  removeReaderMarkdownPopover();
  const popover = document.createElement("div");
  popover.id = "reader-region-markdown-popover";
  popover.className = "reader-region-markdown-popover";
  popover.innerHTML = `
    <div class="reader-region-markdown-head">
      <span>${escapeHtml(region?.itemId || "Văn bản vùng")}</span>
      <button type="button" class="reader-region-markdown-close" aria-label="Đóng">×</button>
    </div>
    <div class="reader-region-markdown-body">${escapeHtml(state?.message || "Đang đọc...")}</div>
  `;
  document.body.appendChild(popover);
  positionReaderMarkdownPopover(popover, event);
  for (const eventName of ["mousedown", "mouseup", "click", "dblclick", "contextmenu"]) {
    popover.addEventListener(eventName, (popoverEvent) => {
      popoverEvent.stopPropagation();
    });
  }
  popover.querySelector(".reader-region-markdown-close")?.addEventListener("click", removeReaderMarkdownPopover);
  popover.addEventListener("click", (clickEvent) => {
    const copyButton = (clickEvent.target as any)?.closest?.(".reader-region-copy-btn");
    if (!copyButton || !popover.contains(copyButton)) {
      return;
    }
    clickEvent.preventDefault();
    copyReaderRegionText(copyButton);
  });
  return popover;
}

export function renderReaderMarkdownPayload(popover, payload) {
  const formatted = formatReaderRegionMarkdownPayload(payload);
  popover.querySelector(".reader-region-markdown-body").innerHTML = `
    ${renderReaderTextBlock(formatted.primaryLabel, formatted.primaryText)}
    ${formatted.source && formatted.primaryText !== formatted.source ? renderReaderTextBlock("Nguồn", formatted.source) : ""}
  `;
  return formatted;
}
