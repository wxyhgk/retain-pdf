import { state } from "../../state.js";

export function getRecentJobsState() {
  return {
    offset: state.recentJobsOffset,
    hasMore: state.recentJobsHasMore,
    date: state.recentJobsDate,
    items: state.recentJobsItems,
  };
}

export function setRecentJobsOffset(value) {
  state.recentJobsOffset = Number(value) || 0;
}

export function setRecentJobsHasMore(value) {
  state.recentJobsHasMore = Boolean(value);
}

export function setRecentJobsDate(value) {
  state.recentJobsDate = `${value || ""}`.trim();
}

export function setRecentJobsItems(items) {
  state.recentJobsItems = Array.isArray(items) ? items : [];
}

export function resetRecentJobsPagination() {
  state.recentJobsOffset = 0;
  state.recentJobsHasMore = true;
  state.recentJobsItems = [];
}
