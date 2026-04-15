import { $ } from "../../dom.js";
import {
  getRecentJobsState,
  resetRecentJobsPagination,
  setRecentJobsDate,
  setRecentJobsHasMore,
  setRecentJobsItems,
  setRecentJobsOffset,
} from "./state.js";
import {
  renderRecentJobsEmpty,
  renderRecentJobsError,
  renderRecentJobsList,
  renderRecentJobsLoading,
  setRecentJobsLoadMoreLoading,
} from "./view.js";

function recentJobDateKey(value) {
  const raw = `${value || ""}`.trim();
  if (!raw) {
    return "";
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function setDialogOpen(open) {
  const dialog = $("query-dialog");
  if (!dialog) {
    return;
  }
  if (open) {
    dialog.showModal();
  } else {
    dialog.close();
  }
  $("open-query-btn")?.setAttribute("aria-expanded", open ? "true" : "false");
}

function dedupeRecentJobs(items) {
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(items) ? items : []) {
    const jobId = `${item?.job_id || ""}`.trim();
    if (!jobId || seen.has(jobId)) {
      continue;
    }
    seen.add(jobId);
    result.push(item);
  }
  return result;
}

function isPrimaryRecentJob(item) {
  const workflow = `${item?.workflow || item?.job_type || ""}`.trim();
  const jobId = `${item?.job_id || ""}`.trim();
  if (workflow === "ocr") {
    return false;
  }
  if (jobId.endsWith("-ocr")) {
    return false;
  }
  return true;
}

export function mountRecentJobsFeature({ fetchJobList, apiPrefix, startPolling }) {
  async function loadRecentJobs({ reset = false } = {}) {
    const list = $("recent-jobs-list");
    const empty = $("recent-jobs-empty");
    const loadMoreButton = $("load-more-jobs-btn");
    if (!list || !empty || !loadMoreButton) {
      return;
    }
    if (reset) {
      resetRecentJobsPagination();
      renderRecentJobsLoading();
    } else {
      setRecentJobsLoadMoreLoading();
    }

    try {
      const { date, offset, items: previousItems } = getRecentJobsState();
      const selectedDate = date || new Date().toLocaleDateString("en-CA");
      const pageSize = 5;
      const collected = [];
      let reachedOlderDate = false;
      let latestInvocationSummary = null;
      let nextOffset = offset;
      let hasMore = true;

      if (reset) {
        while (collected.length < pageSize && !reachedOlderDate) {
          const payload = await fetchJobList(apiPrefix, { limit: pageSize, offset: nextOffset });
          latestInvocationSummary = payload?.invocation_summary || latestInvocationSummary;
          const items = Array.isArray(payload?.items) ? payload.items : [];
          if (items.length === 0) {
            hasMore = false;
            break;
          }
          nextOffset += items.length;
          for (const item of items) {
            if (!isPrimaryRecentJob(item)) {
              continue;
            }
            const dateKey = recentJobDateKey(item.updated_at || item.created_at);
            if (!dateKey) {
              continue;
            }
            if (dateKey > selectedDate) {
              continue;
            }
            if (dateKey === selectedDate) {
              collected.push(item);
              if (collected.length >= pageSize) {
                break;
              }
              continue;
            }
            if (dateKey < selectedDate) {
              reachedOlderDate = true;
              break;
            }
          }
          if (items.length < pageSize) {
            hasMore = false;
            break;
          }
        }
      } else {
        const payload = await fetchJobList(apiPrefix, { limit: pageSize, offset: nextOffset });
        latestInvocationSummary = payload?.invocation_summary || latestInvocationSummary;
        const items = Array.isArray(payload?.items) ? payload.items : [];
        const visibleItems = items.filter(isPrimaryRecentJob);
        if (items.length === 0) {
          hasMore = false;
        } else {
          collected.push(...visibleItems);
          nextOffset += items.length;
          hasMore = items.length === pageSize;
        }
      }

      if (reset && collected.length === 0) {
        setRecentJobsItems([]);
        setRecentJobsHasMore(false);
        renderRecentJobsEmpty("所选日期暂无任务", latestInvocationSummary);
        return;
      }
      if (!reset && collected.length === 0) {
        setRecentJobsHasMore(false);
        renderRecentJobsError("", { reset: false });
        return;
      }

      const nextItems = dedupeRecentJobs(reset ? collected : [...previousItems, ...collected]);
      setRecentJobsOffset(nextOffset);
      setRecentJobsHasMore(hasMore);
      setRecentJobsItems(nextItems);
      renderRecentJobsList({
        items: nextItems,
        allItems: nextItems,
        invocationSummary: latestInvocationSummary,
        reset: true,
        hasMore,
        onSelect(jobId) {
          if (!jobId) {
            return;
          }
          closeRecentJobsDialog();
          startPolling(jobId);
        },
      });
    } catch (err) {
      if (!reset) {
        setRecentJobsHasMore(false);
      }
      renderRecentJobsError(err.message || "读取最近任务失败", { reset });
    }
  }

  function openRecentJobsDialog() {
    const { date } = getRecentJobsState();
    if (!date) {
      setRecentJobsDate(new Date().toLocaleDateString("en-CA"));
    }
    if ($("recent-jobs-date")) {
      $("recent-jobs-date").value = getRecentJobsState().date;
    }
    loadRecentJobs({ reset: true });
    setDialogOpen(true);
  }

  function closeRecentJobsDialog() {
    setDialogOpen(false);
  }

  $("open-query-btn")?.addEventListener("click", openRecentJobsDialog);
  $("refresh-jobs-btn")?.addEventListener("click", () => loadRecentJobs({ reset: true }));
  $("load-more-jobs-btn")?.addEventListener("click", () => loadRecentJobs({ reset: false }));
  $("recent-jobs-date")?.addEventListener("change", (event) => {
    const target = event.currentTarget;
    if (target instanceof HTMLInputElement) {
      setRecentJobsDate(target.value || new Date().toLocaleDateString("en-CA"));
      loadRecentJobs({ reset: true });
    }
  });

  return {
    openRecentJobsDialog,
    closeRecentJobsDialog,
    loadRecentJobs,
  };
}
