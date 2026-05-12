import { $ } from "../../dom.js";

function recentJobsDialogComponent() {
  return document.querySelector("recent-jobs-dialog");
}

export function hasRecentJobsView() {
  const component = recentJobsDialogComponent();
  if (component) {
    return true;
  }
  return Boolean($("recent-jobs-list") && $("recent-jobs-empty") && $("load-more-jobs-btn"));
}

export function setRecentJobsDialogOpen(open) {
  const component = recentJobsDialogComponent();
  if (component?.setOpen) {
    component.setOpen(open);
  } else {
    const dialog = $("query-dialog");
    if (!dialog) {
      return;
    }
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }
  $("open-query-btn")?.setAttribute("aria-expanded", open ? "true" : "false");
}

export function setRecentJobsDateInput(value) {
  const component = recentJobsDialogComponent();
  if (component?.setDateValue) {
    component.setDateValue(value);
    return;
  }
  const input = $("recent-jobs-date");
  if (input instanceof HTMLInputElement) {
    input.value = value || "";
  }
}

export function bindRecentJobsEvents({
  onOpen,
  onRefresh,
  onLoadMore,
  onDateChange,
} = {}) {
  $("open-query-btn")?.addEventListener("click", () => onOpen?.());

  const component = recentJobsDialogComponent();
  if (component?.bindEvents) {
    component.bindEvents({ onRefresh, onLoadMore, onDateChange });
    return;
  }

  $("refresh-jobs-btn")?.addEventListener("click", () => onRefresh?.());
  $("load-more-jobs-btn")?.addEventListener("click", () => onLoadMore?.());
  $("recent-jobs-date")?.addEventListener("change", (event) => {
    const target = event.currentTarget;
    if (target instanceof HTMLInputElement) {
      onDateChange?.(target.value || "");
    }
  });
}

function recentJobStatusLabel(status) {
  switch (`${status || ""}`.trim()) {
    case "queued":
      return "排队中";
    case "running":
      return "进行中";
    case "succeeded":
      return "已完成";
    case "failed":
      return "失败";
    case "canceled":
      return "已取消";
    default:
      return status || "-";
  }
}

function recentJobProtocolLabel(item) {
  const protocol = `${item?.invocation?.input_protocol || ""}`.trim();
  if (protocol === "stage_spec") {
    return "Stage Spec";
  }
  return "Unknown";
}

function recentJobProtocolClass(item) {
  const protocol = `${item?.invocation?.input_protocol || ""}`.trim();
  if (protocol === "stage_spec") {
    return "is-valid";
  }
  return "";
}

function truncateRecentJobName(value) {
  const text = `${value || ""}`.trim();
  if (!text) {
    return "-";
  }
  return text.length > 30 ? `${text.slice(0, 30)}...` : text;
}

function recentJobTitle(item) {
  return truncateRecentJobName(item.display_name || item.job_id || "-");
}

function recentJobKindLabel(item) {
  const workflow = `${item?.workflow || item?.job_type || ""}`.trim();
  if (workflow === "render") {
    return "render";
  }
  if (workflow === "translate") {
    return "translate";
  }
  if (workflow === "ocr") {
    return "ocr";
  }
  if ((item?.job_id || "").endsWith("-ocr")) {
    return "ocr-subtask";
  }
  return workflow || "job";
}

function summarizeInvocationCounts(items) {
  let stageSpecCount = 0;
  let unknownCount = 0;
  for (const item of Array.isArray(items) ? items : []) {
    const protocol = `${item?.invocation?.input_protocol || ""}`.trim();
    if (protocol === "stage_spec") {
      stageSpecCount += 1;
    } else {
      unknownCount += 1;
    }
  }
  return { stageSpecCount, unknownCount };
}

export function renderRecentJobsSummary(invocationSummary, items) {
  const stageSpecCountValue = Number(invocationSummary?.stage_spec_count);
  const unknownCountValue = Number(invocationSummary?.unknown_count);
  const counts = Number.isFinite(stageSpecCountValue) && Number.isFinite(unknownCountValue)
    ? { stageSpecCount: stageSpecCountValue, unknownCount: unknownCountValue }
    : summarizeInvocationCounts(items);
  const text = `Stage Spec ${counts.stageSpecCount} · Unknown ${counts.unknownCount}`;
  const component = recentJobsDialogComponent();
  if (component?.renderSummary) {
    component.renderSummary(text);
    return;
  }
  const summaryEl = $("recent-jobs-summary");
  if (summaryEl) {
    summaryEl.textContent = text;
  }
}

export function renderRecentJobsLoading() {
  const component = recentJobsDialogComponent();
  if (component?.renderLoading) {
    component.renderLoading();
    return;
  }
  const list = $("recent-jobs-list");
  const empty = $("recent-jobs-empty");
  const loadMoreButton = $("load-more-jobs-btn");
  if (!list || !empty || !loadMoreButton) {
    return;
  }
  empty.classList.add("hidden");
  list.classList.remove("hidden");
  list.innerHTML = '<div class="events-empty">正在加载最近任务…</div>';
  loadMoreButton.classList.add("hidden");
}

export function renderRecentJobsEmpty(message, invocationSummary = null) {
  const component = recentJobsDialogComponent();
  const list = $("recent-jobs-list");
  const empty = $("recent-jobs-empty");
  const loadMoreButton = $("load-more-jobs-btn");
  if (!component?.renderEmpty && (!list || !empty || !loadMoreButton)) {
    return;
  }
  renderRecentJobsSummary(invocationSummary, []);
  if (component?.renderEmpty) {
    component.renderEmpty(message);
    return;
  }
  list.innerHTML = "";
  list.classList.add("hidden");
  empty.textContent = message || "暂无最近任务";
  empty.classList.remove("hidden");
  loadMoreButton.classList.add("hidden");
  loadMoreButton.disabled = false;
  loadMoreButton.textContent = "更多";
}

export function renderRecentJobsError(message, { reset = false } = {}) {
  const component = recentJobsDialogComponent();
  if (component?.renderError) {
    component.renderError(message, { reset });
    return;
  }
  const list = $("recent-jobs-list");
  const empty = $("recent-jobs-empty");
  const loadMoreButton = $("load-more-jobs-btn");
  if (!list || !empty || !loadMoreButton) {
    return;
  }
  if (reset) {
    list.innerHTML = "";
    list.classList.add("hidden");
    empty.textContent = message || "读取最近任务失败";
    empty.classList.remove("hidden");
  } else {
    loadMoreButton.classList.add("hidden");
  }
  loadMoreButton.disabled = false;
  loadMoreButton.textContent = "更多";
}

function buildRecentJobsMarkup(items) {
  return items.map((item) => `
    <button type="button" class="recent-job-item" data-job-id="${item.job_id || ""}">
      <div class="recent-job-top">
        <div class="recent-job-title-wrap">
          <span class="recent-job-id" title="${(item.display_name || item.job_id || "-").replaceAll('"', "&quot;")}">${recentJobTitle(item)}</span>
          <span class="recent-job-real-id mono">${item.job_id || "-"}</span>
        </div>
        <span class="recent-job-status">${recentJobStatusLabel(item.status)}</span>
      </div>
      <div class="recent-job-meta">
        <span>类型: ${recentJobKindLabel(item)}</span>
        <span>阶段: ${item.stage || "-"}</span>
        <span>更新: ${item.updated_at || "-"}</span>
        <span class="recent-job-protocol ${recentJobProtocolClass(item)}">${recentJobProtocolLabel(item)}</span>
      </div>
    </button>
  `).join("");
}

export function renderRecentJobsList({
  items,
  allItems,
  invocationSummary,
  reset = false,
  hasMore = false,
  onSelect,
}) {
  const component = recentJobsDialogComponent();
  const list = $("recent-jobs-list");
  const empty = $("recent-jobs-empty");
  const loadMoreButton = $("load-more-jobs-btn");
  if (!component?.renderList && (!list || !empty || !loadMoreButton)) {
    return;
  }
  renderRecentJobsSummary(invocationSummary, allItems);
  const markup = buildRecentJobsMarkup(items);
  if (component?.renderList) {
    component.renderList(markup, { reset, hasMore, onSelect });
    return;
  }
  list.classList.remove("hidden");
  empty.classList.add("hidden");
  list.__retainPdfRecentJobSelect = onSelect;
  if (!list.__retainPdfRecentJobBound) {
    list.__retainPdfRecentJobBound = true;
    list.addEventListener("click", (event) => {
      const button = event.target?.closest?.(".recent-job-item");
      if (!button || !list.contains(button)) {
        return;
      }
      event.preventDefault();
      list.__retainPdfRecentJobSelect?.(button.dataset.jobId || "");
    });
  }
  list.innerHTML = reset ? markup : `${list.innerHTML}${markup}`;
  loadMoreButton.classList.toggle("hidden", !hasMore);
  loadMoreButton.disabled = false;
  loadMoreButton.textContent = "更多";
}

export function setRecentJobsLoadMoreLoading() {
  const component = recentJobsDialogComponent();
  if (component?.setLoadMoreLoading) {
    component.setLoadMoreLoading();
    return;
  }
  const loadMoreButton = $("load-more-jobs-btn");
  if (!loadMoreButton) {
    return;
  }
  loadMoreButton.disabled = true;
  loadMoreButton.textContent = "加载中…";
}
