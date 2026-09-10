export type LibraryPageMode = "list" | "loading" | "error" | "empty";

export type DeriveLibraryPageStateInput = {
  items?: readonly unknown[] | null;
  loadingState?: unknown;
  error?: unknown;
  query?: unknown;
  // libraryViewStore 的兼容错误通道；store-driven 列表不再信任其 list/loading 状态。
  viewMode?: unknown;
  viewMessage?: unknown;
};

export type LibraryPageState = {
  mode: LibraryPageMode;
  loadMoreLoading: boolean;
  errorMessage: string;
  emptyMessage: string;
};

const EMPTY_MESSAGE = "暂无最近任务";
const EMPTY_SEARCH_MESSAGE = "没有匹配的书籍";

function text(value: unknown): string {
  return `${value ?? ""}`.trim();
}

/**
 * Library 页面的唯一展示态推导。
 *
 * items 是列表是否可见的第一信号：silent refresh / load-more 期间保留现有卡片，
 * 只把 loading 映射为底部加载态。libraryViewStore 暂时只作为旧 error 通道兼容，
 * 不再让可能陈旧的 list/loading mode 覆盖真实列表快照。
 */
export function deriveLibraryPageState({
  items,
  loadingState,
  error,
  query,
  viewMode,
  viewMessage,
}: DeriveLibraryPageStateInput = {}): LibraryPageState {
  const hasItems = Array.isArray(items) && items.length > 0;
  const normalizedLoadingState = text(loadingState);
  const normalizedViewMode = text(viewMode);
  const normalizedQuery = text(query);
  const isLoading = normalizedLoadingState === "loading";
  const isError = normalizedLoadingState === "error" || normalizedViewMode === "error";
  const emptyMessage = normalizedQuery ? EMPTY_SEARCH_MESSAGE : EMPTY_MESSAGE;
  const compatibilityError = normalizedViewMode === "error" ? text(viewMessage) : "";

  return {
    mode: hasItems ? "list" : (isLoading ? "loading" : (isError ? "error" : "empty")),
    loadMoreLoading: hasItems && isLoading,
    errorMessage: compatibilityError || text(error) || EMPTY_MESSAGE,
    emptyMessage,
  };
}
