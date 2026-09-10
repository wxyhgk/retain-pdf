export const RECENT_JOBS_IDS = Object.freeze({
  libraryView: "library-view",
  list: "recent-jobs-list",
  empty: "recent-jobs-empty",
  summary: "recent-jobs-summary",
  loadMoreButton: "load-more-jobs-btn",
  scrollBody: "recent-jobs-scroll-body",
  openButton: "open-query-btn",
  searchInput: "library-search-input",
});

export const RECENT_JOBS_TAGS = Object.freeze({
  dialog: "recent-jobs-dialog",
  card: "recent-job-card",
});

export const RECENT_JOBS_CLASSES = Object.freeze({
  item: "recent-job-item",
  hidden: "hidden",
});

export const RECENT_JOBS_SELECTORS = Object.freeze({
  libraryList: `#${RECENT_JOBS_IDS.libraryView} #${RECENT_JOBS_IDS.list}`,
  item: `.${RECENT_JOBS_CLASSES.item}`,
});

export const RECENT_JOBS_PRIVATE_KEYS = Object.freeze({
  select: "__retainPdfRecentJobSelect",
  delete: "__retainPdfRecentJobDelete",
  reader: "__retainPdfRecentJobReader",
  listBound: "__retainPdfRecentJobBound",
  cardBound: "__retainPdfRecentJobCardBound",
});
