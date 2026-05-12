export function recentJobsElements(host) {
  return {
    summary: host.querySelector("#recent-jobs-summary"),
    list: host.querySelector("#recent-jobs-list"),
    empty: host.querySelector("#recent-jobs-empty"),
    loadMoreButton: host.querySelector("#load-more-jobs-btn"),
    dateInput: host.querySelector("#recent-jobs-date"),
    dialog: host.querySelector("#query-dialog"),
  };
}

export function setRecentJobsOpen(host, open) {
  const { dialog } = recentJobsElements(host);
  if (!dialog) {
    return;
  }
  if (open) {
    dialog.showModal();
  } else {
    dialog.close();
  }
}

export function setRecentJobsDateValue(host, value) {
  const { dateInput } = recentJobsElements(host);
  if (dateInput) {
    dateInput.value = value || "";
  }
}

export function renderRecentJobsSummary(host, text) {
  const { summary } = recentJobsElements(host);
  if (summary) {
    summary.textContent = text;
  }
}

export function renderRecentJobsLoading(host) {
  const { list, empty, loadMoreButton } = recentJobsElements(host);
  if (!list || !empty || !loadMoreButton) {
    return;
  }
  empty.classList.add("hidden");
  list.classList.remove("hidden");
  list.innerHTML = '<div class="events-empty">正在加载最近任务...</div>';
  loadMoreButton.classList.add("hidden");
}

export function renderRecentJobsEmpty(host, message) {
  const { list, empty, loadMoreButton } = recentJobsElements(host);
  if (!list || !empty || !loadMoreButton) {
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

export function renderRecentJobsError(host, message, { reset = false } = {}) {
  const { list, empty, loadMoreButton } = recentJobsElements(host);
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

export function renderRecentJobsList(host, markup, { reset = false, hasMore = false, onSelect } = {}) {
  const { list, empty, loadMoreButton } = recentJobsElements(host);
  if (!list || !empty || !loadMoreButton) {
    return;
  }
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
  list.classList.remove("hidden");
  empty.classList.add("hidden");
  list.innerHTML = reset ? markup : `${list.innerHTML}${markup}`;
  loadMoreButton.classList.toggle("hidden", !hasMore);
  loadMoreButton.disabled = false;
  loadMoreButton.textContent = "更多";
}

export function setRecentJobsLoadMoreLoading(host) {
  const { loadMoreButton } = recentJobsElements(host);
  if (!loadMoreButton) {
    return;
  }
  loadMoreButton.disabled = true;
  loadMoreButton.textContent = "加载中...";
}
