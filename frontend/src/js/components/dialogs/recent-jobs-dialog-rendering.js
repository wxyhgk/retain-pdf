import { buildApiHeaders, buildApiUrl } from "../../config.js";

const recentJobImageCache = new Map();

function normalizeRecentJobImageUrl(value) {
  const raw = `${value || ""}`.trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if ((parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") && parsed.pathname.startsWith("/api/v1/")) {
        return `${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return raw;
    }
    return raw;
  }
  if (raw.startsWith("/api/v1/")) {
    return raw;
  }
  return buildApiUrl("", raw.replace(/^\/+/, ""));
}

async function loadRecentJobImage(rawUrl) {
  const url = normalizeRecentJobImageUrl(rawUrl);
  if (!url) {
    return "";
  }
  if (recentJobImageCache.has(url)) {
    return recentJobImageCache.get(url);
  }
  const request = fetch(url, { headers: buildApiHeaders() })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`image failed: ${response.status}`);
      }
      return response.blob();
    })
    .then((blob) => URL.createObjectURL(blob))
    .catch((error) => {
      recentJobImageCache.delete(url);
      throw error;
    });
  recentJobImageCache.set(url, request);
  return request;
}

function hydrateRecentJobImages(list) {
  list.querySelectorAll(".recent-job-cover[data-image-url]").forEach((cover) => {
    const rawUrl = cover.getAttribute("data-image-url") || "";
    if (!rawUrl || cover.dataset.loaded === "1") {
      return;
    }
    cover.dataset.loaded = "1";
    loadRecentJobImage(rawUrl)
      .then((objectUrl) => {
        if (!objectUrl) {
          return;
        }
        cover.style.backgroundImage = `url("${objectUrl}")`;
        cover.classList.add("has-image");
      })
      .catch(() => {
        cover.classList.add("is-missing");
      });
  });
}

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

export function renderRecentJobsList(host, markup, { reset = false, hasMore = false, onSelect, onDelete } = {}) {
  const { list, empty, loadMoreButton } = recentJobsElements(host);
  if (!list || !empty || !loadMoreButton) {
    return;
  }
  list.__retainPdfRecentJobSelect = onSelect;
  list.__retainPdfRecentJobDelete = onDelete;
  if (!list.__retainPdfRecentJobBound) {
    list.__retainPdfRecentJobBound = true;
    list.addEventListener("click", (event) => {
      const cancelButton = event.target?.closest?.(".recent-job-delete-cancel");
      if (cancelButton && list.contains(cancelButton)) {
        event.preventDefault();
        event.stopPropagation();
        cancelButton.closest(".recent-job-item")?.classList.remove("is-confirming-delete");
        return;
      }
      const confirmButton = event.target?.closest?.(".recent-job-delete-confirm");
      if (confirmButton && list.contains(confirmButton)) {
        event.preventDefault();
        event.stopPropagation();
        const item = confirmButton.closest(".recent-job-item");
        item?.classList.remove("is-confirming-delete");
        list.__retainPdfRecentJobDelete?.(item?.dataset.jobId || "");
        return;
      }
      const deleteButton = event.target?.closest?.(".recent-job-delete");
      if (deleteButton && list.contains(deleteButton)) {
        event.preventDefault();
        event.stopPropagation();
        const item = deleteButton.closest(".recent-job-item");
        list.querySelectorAll(".recent-job-item.is-confirming-delete").forEach((node) => {
          if (node !== item) {
            node.classList.remove("is-confirming-delete");
          }
        });
        item?.classList.toggle("is-confirming-delete");
        return;
      }
      const button = event.target?.closest?.(".recent-job-item");
      if (!button || !list.contains(button)) {
        list.querySelectorAll(".recent-job-item.is-confirming-delete").forEach((node) => {
          node.classList.remove("is-confirming-delete");
        });
        return;
      }
      event.preventDefault();
      list.querySelectorAll(".recent-job-item.is-confirming-delete").forEach((node) => {
        node.classList.remove("is-confirming-delete");
      });
      list.__retainPdfRecentJobSelect?.(button.dataset.jobId || "");
    });
    list.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      const item = event.target?.closest?.(".recent-job-item");
      if (!item || !list.contains(item)) {
        return;
      }
      event.preventDefault();
      list.__retainPdfRecentJobSelect?.(item.dataset.jobId || "");
    });
  }
  list.classList.remove("hidden");
  empty.classList.add("hidden");
  list.innerHTML = reset ? markup : `${list.innerHTML}${markup}`;
  hydrateRecentJobImages(list);
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
