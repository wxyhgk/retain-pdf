import {
  getRecentJobsState,
  resetRecentJobsPagination,
  setRecentJobsDate,
  setRecentJobsHasMore,
  setRecentJobsItems,
  setRecentJobsOffset,
} from "./state.js";
import {
  bindRecentJobsEvents,
  hasRecentJobsView,
  renderRecentJobsEmpty,
  renderRecentJobsError,
  renderRecentJobsList,
  renderRecentJobsLoading,
  setRecentJobsDateInput,
  setRecentJobsDialogOpen,
  setRecentJobsLoadMoreLoading,
} from "./view.js";

function padDatePart(value) {
  return `${value}`.padStart(2, "0");
}

function formatDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function recentJobDateKey(value) {
  const raw = `${value || ""}`.trim();
  if (!raw) {
    return "";
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return formatDateKey(parsed);
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

async function collectRecentJobsPage(fetchJobList, fetchLibraryBookList, apiPrefix, startOffset, selectedDate, pageSize) {
  const fetchLimit = Math.max(pageSize, 20);
  const collected = [];
  let latestInvocationSummary = null;
  let nextOffset = startOffset;
  let hasMore = true;

  while (collected.length < pageSize) {
    const payload = fetchLibraryBookList
      ? await fetchLibraryBookList(apiPrefix, { limit: fetchLimit, offset: nextOffset })
      : await fetchJobList(apiPrefix, { limit: fetchLimit, offset: nextOffset });
    latestInvocationSummary = payload?.invocation_summary || latestInvocationSummary;
    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (items.length === 0) {
      hasMore = false;
      break;
    }

    let consumed = 0;
    for (const item of items) {
      consumed += 1;
      if (!isPrimaryRecentJob(item)) {
        continue;
      }
      const dateKey = recentJobDateKey(item.updated_at || item.created_at);
      if (!dateKey) {
        continue;
      }
      if (selectedDate) {
        if (dateKey > selectedDate) {
          continue;
        }
        if (dateKey < selectedDate) {
          hasMore = false;
          break;
        }
      }
      collected.push(item);
      if (collected.length >= pageSize) {
        break;
      }
    }

    nextOffset += consumed;

    if (!hasMore || collected.length >= pageSize) {
      break;
    }
    if (items.length < fetchLimit) {
      hasMore = false;
      break;
    }
  }

  return {
    collected,
    hasMore,
    latestInvocationSummary,
    nextOffset,
  };
}

export function mountRecentJobsFeature({ fetchJobList, fetchLibraryBookList, deleteLibraryBook, apiPrefix, startPolling }) {
  function renderCurrentRecentJobs({ reset = true, invocationSummary = null } = {}) {
    const { items, hasMore } = getRecentJobsState();
    renderRecentJobsList({
      items,
      allItems: items,
      invocationSummary,
      reset,
      hasMore,
      onSelect: handleSelectRecentJob,
      onDelete: handleDeleteRecentJob,
    });
  }

  function handleSelectRecentJob(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
      renderRecentJobsError("该任务缺少 job_id，无法打开。", { reset: false });
      return;
    }
    closeRecentJobsDialog();
    startPolling(normalizedJobId);
  }

  async function handleDeleteRecentJob(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId || !deleteLibraryBook) {
      return;
    }
    try {
      await deleteLibraryBook(apiPrefix, normalizedJobId);
    } catch (error) {
      const message = error?.message || String(error);
      if (message.includes("(409)")) {
        await deleteLibraryBook(apiPrefix, normalizedJobId, { force: true });
      } else {
        renderRecentJobsError(message || "删除失败", { reset: false });
        return;
      }
    }
    const rootJobId = normalizedJobId.replace(/-ocr$/, "");
    const nextItems = getRecentJobsState().items.filter((item) => {
      const itemJobId = `${item?.job_id || ""}`.trim();
      return itemJobId !== rootJobId && itemJobId !== `${rootJobId}-ocr`;
    });
    setRecentJobsItems(nextItems);
    if (nextItems.length === 0) {
      renderRecentJobsEmpty("暂无最近任务");
      return;
    }
    renderCurrentRecentJobs({ reset: true });
  }

  async function loadRecentJobs({ reset = false } = {}) {
    if (!hasRecentJobsView()) {
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
      const selectedDate = `${date || ""}`.trim();
      const pageSize = 24;
      const {
        collected,
        hasMore,
        latestInvocationSummary,
        nextOffset,
      } = await collectRecentJobsPage(
        fetchJobList,
        fetchLibraryBookList,
        apiPrefix,
        reset ? 0 : offset,
        selectedDate,
        pageSize,
      );

      if (reset && collected.length === 0) {
        setRecentJobsItems([]);
        setRecentJobsHasMore(false);
        renderRecentJobsEmpty(selectedDate ? "所选日期暂无任务" : "暂无最近任务", latestInvocationSummary);
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
        reset,
        hasMore,
        onSelect: handleSelectRecentJob,
        onDelete: handleDeleteRecentJob,
      });
    } catch (err) {
      if (!reset) {
        setRecentJobsHasMore(false);
      }
      renderRecentJobsError(err.message || "读取最近任务失败", { reset });
    }
  }

  function openRecentJobsDialog() {
    setRecentJobsDateInput(getRecentJobsState().date);
    loadRecentJobs({ reset: true });
    setRecentJobsDialogOpen(true);
  }

  function closeRecentJobsDialog() {
    setRecentJobsDialogOpen(false);
  }

  bindRecentJobsEvents({
    onOpen: openRecentJobsDialog,
    onRefresh: () => loadRecentJobs({ reset: true }),
    onLoadMore: () => loadRecentJobs({ reset: false }),
    onDateChange(value) {
      setRecentJobsDate(value || "");
      loadRecentJobs({ reset: true });
    },
  });

  return {
    openRecentJobsDialog,
    closeRecentJobsDialog,
    loadRecentJobs,
  };
}
