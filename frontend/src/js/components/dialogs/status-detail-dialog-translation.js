import {
  translationItemDetailElements,
  translationItemsElements,
  translationReplayElements,
  translationSummaryElements,
} from "./status-detail-dialog-translation-dom.js";

export function renderTranslationSummary(host, {
  counts = {},
  finalStatusCounts = {},
  providerFamily = "",
  emptyText = "",
  hidden = false,
  summaryScopeText = "-",
  filterText = "-",
} = {}) {
  const elements = translationSummaryElements(host);
  const normalizedCounts = Object.keys(finalStatusCounts || {}).length ? finalStatusCounts : (counts || {});
  const countValues = {
    translated: normalizedCounts.translated,
    keptOrigin: normalizedCounts.kept_origin,
    skipped: normalizedCounts.skipped,
    providerFamily: providerFamily || "-",
  };
  Object.entries(countValues).forEach(([key, value]) => {
    if (elements.counts[key]) {
      elements.counts[key].textContent = value ?? 0;
    }
  });
  if (elements.status) {
    elements.status.textContent = hidden ? "暂无翻译调试数据" : "按 item 查看保留原文、跳过与重放结果";
  }
  if (elements.scope) {
    elements.scope.textContent = `摘要统计范围：${summaryScopeText}`;
  }
  if (elements.filter) {
    elements.filter.textContent = `当前列表筛选：${filterText}`;
  }
  if (elements.content) {
    elements.content.classList.toggle("hidden", hidden);
  }
  if (elements.empty) {
    elements.empty.textContent = emptyText || "暂无翻译调试数据";
    elements.empty.classList.toggle("hidden", !hidden);
  }
}

export function renderTranslationItems(host, {
  markup = "",
  hasItems = false,
  emptyText = "没有匹配的翻译 item",
  meta = "-",
  loading = false,
  pageLabel = "-",
  canPrev = false,
  canNext = false,
} = {}) {
  const elements = translationItemsElements(host);
  if (elements.meta) {
    elements.meta.textContent = meta;
  }
  if (elements.page) {
    elements.page.textContent = pageLabel;
  }
  if (elements.prevButton) {
    elements.prevButton.disabled = loading || !canPrev;
  }
  if (elements.nextButton) {
    elements.nextButton.disabled = loading || !canNext;
  }
  if (elements.loading) {
    elements.loading.classList.toggle("hidden", !loading);
  }
  if (!elements.list || !elements.empty) {
    return;
  }
  if (loading) {
    elements.list.innerHTML = "";
    elements.list.classList.add("hidden");
    elements.empty.classList.add("hidden");
    return;
  }
  if (!hasItems) {
    elements.list.innerHTML = "";
    elements.list.classList.add("hidden");
    elements.empty.textContent = emptyText;
    elements.empty.classList.remove("hidden");
    return;
  }
  elements.empty.classList.add("hidden");
  elements.list.classList.remove("hidden");
  elements.list.innerHTML = markup;
}

export function renderTranslationItemDetail(host, {
  markup = "",
  meta = "-",
  hasItem = false,
  emptyText = "请选择左侧 item",
  loading = false,
  replayEnabled = false,
} = {}) {
  const elements = translationItemDetailElements(host);
  if (elements.meta) {
    elements.meta.textContent = meta;
  }
  if (elements.loading) {
    elements.loading.classList.toggle("hidden", !loading);
  }
  if (elements.replayButton) {
    elements.replayButton.disabled = !replayEnabled;
  }
  if (!elements.detail || !elements.empty) {
    return;
  }
  if (loading) {
    elements.detail.innerHTML = "";
    elements.detail.classList.add("hidden");
    elements.empty.classList.add("hidden");
    return;
  }
  if (!hasItem) {
    elements.detail.innerHTML = "";
    elements.detail.classList.add("hidden");
    elements.empty.textContent = emptyText;
    elements.empty.classList.remove("hidden");
    return;
  }
  elements.empty.classList.add("hidden");
  elements.detail.classList.remove("hidden");
  elements.detail.innerHTML = markup;
}

export function renderTranslationReplay(host, {
  markup = "",
  hasResult = false,
  status = "-",
} = {}) {
  const elements = translationReplayElements(host);
  if (elements.status) {
    elements.status.textContent = status;
  }
  if (!elements.result) {
    return;
  }
  if (!hasResult) {
    elements.result.innerHTML = "";
    elements.result.classList.add("hidden");
    return;
  }
  elements.result.innerHTML = markup;
  elements.result.classList.remove("hidden");
}
