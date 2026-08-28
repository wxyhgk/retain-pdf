import {
  createStore,
  type BoundStoreActions,
  type Store,
  type StoreListener,
} from "../../app-framework/store.js";
import { dedupeRecentJobs } from "./pagination.js";
import type { LibraryJobItem, StageAdapterPort } from "./runtime-item.js";

export type { LibraryJobItem, StageAdapterPort };

export interface RecentJobsState {
  offset: number;
  hasMore: boolean;
  invocationSummary: Record<string, unknown> | null;
  items: LibraryJobItem[];
}

/** Initial state tương thích tên field phẳng cũ. */
export type RecentJobsInitialState = Partial<RecentJobsState> & {
  recentJobsOffset?: number;
  recentJobsHasMore?: boolean;
  recentJobsItems?: LibraryJobItem[];
};

export type RecentJobsActions = {
  setOffset(currentState: RecentJobsState, value?: unknown): RecentJobsState;
  setHasMore(currentState: RecentJobsState, value?: unknown): RecentJobsState;
  setItems(currentState: RecentJobsState, items?: unknown): RecentJobsState;
  setInvocationSummary(
    currentState: RecentJobsState,
    invocationSummary?: unknown,
  ): RecentJobsState;
  replaceItem(
    currentState: RecentJobsState,
    item?: LibraryJobItem | null,
  ): RecentJobsState;
  prependItem(
    currentState: RecentJobsState,
    item?: LibraryJobItem | null,
  ): RecentJobsState;
  removeJobFamily(currentState: RecentJobsState, jobId?: unknown): RecentJobsState;
  resetPagination(currentState: RecentJobsState): RecentJobsState;
};

export type RecentJobsStore = Store<RecentJobsState, RecentJobsActions>;

export interface RecentJobsBatchApi {
  actions: BoundStoreActions<RecentJobsState, RecentJobsActions>;
  getSnapshot: () => RecentJobsState;
  setHasMore: BoundStoreActions<RecentJobsState, RecentJobsActions>["setHasMore"];
  setInvocationSummary: BoundStoreActions<RecentJobsState, RecentJobsActions>["setInvocationSummary"];
  setItems: BoundStoreActions<RecentJobsState, RecentJobsActions>["setItems"];
  setOffset: BoundStoreActions<RecentJobsState, RecentJobsActions>["setOffset"];
  replaceItem: BoundStoreActions<RecentJobsState, RecentJobsActions>["replaceItem"];
  prependItem: BoundStoreActions<RecentJobsState, RecentJobsActions>["prependItem"];
  removeJobFamily: BoundStoreActions<RecentJobsState, RecentJobsActions>["removeJobFamily"];
}

export interface RecentJobsStatePort {
  batch(callback?: (api: RecentJobsBatchApi) => void): RecentJobsState;
  getSnapshot(): RecentJobsState;
  prependItem(item?: LibraryJobItem | null): void;
  removeJobFamily(jobId?: unknown): void;
  replaceItem(item?: LibraryJobItem | null): void;
  resetPagination(): void;
  setHasMore(value?: unknown): void;
  setInvocationSummary(invocationSummary?: unknown): void;
  setItems(items?: unknown): void;
  setOffset(value?: unknown): void;
  subscribe(listener: StoreListener<RecentJobsState>): () => void;
  store: RecentJobsStore;
}

function normalizedJobId(value: unknown = ""): string {
  return `${value || ""}`.trim();
}

function asJobItems(items: unknown): LibraryJobItem[] {
  return Array.isArray(items) ? (items as LibraryJobItem[]) : [];
}

function asInvocationSummary(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function createRecentJobsStore(
  initialState: RecentJobsInitialState = {},
): RecentJobsStore {
  return createStore<RecentJobsState, RecentJobsActions>({
    name: "recentJobs",
    initialState: {
      offset: Number(initialState.offset ?? initialState.recentJobsOffset) || 0,
      hasMore: initialState.hasMore ?? initialState.recentJobsHasMore ?? true,
      invocationSummary: asInvocationSummary(initialState.invocationSummary ?? null),
      items: asJobItems(initialState.items ?? initialState.recentJobsItems),
    },
    actions: {
      setOffset(currentState, value) {
        return {
          ...currentState,
          offset: Number(value) || 0,
        };
      },
      setHasMore(currentState, value) {
        return {
          ...currentState,
          hasMore: Boolean(value),
        };
      },
      setItems(currentState, items) {
        return {
          ...currentState,
          items: asJobItems(items),
        };
      },
      setInvocationSummary(currentState, invocationSummary = null) {
        return {
          ...currentState,
          invocationSummary: asInvocationSummary(invocationSummary),
        };
      },
      replaceItem(currentState, item) {
        const jobId = normalizedJobId(item?.job_id);
        if (!jobId || !item) {
          return currentState;
        }
        return {
          ...currentState,
          items: currentState.items.map((currentItem) => (
            normalizedJobId(currentItem?.job_id) === jobId ? item : currentItem
          )),
        };
      },
      prependItem(currentState, item) {
        const jobId = normalizedJobId(item?.job_id);
        if (!jobId || !item) {
          return currentState;
        }
        return {
          ...currentState,
          items: dedupeRecentJobs([item, ...currentState.items]) as LibraryJobItem[],
        };
      },
      removeJobFamily(currentState, jobId) {
        const rootJobId = normalizedJobId(jobId).replace(/-ocr$/, "");
        if (!rootJobId) {
          return currentState;
        }
        return {
          ...currentState,
          items: currentState.items.filter((entry) => {
            const itemJobId = normalizedJobId(entry?.job_id);
            return itemJobId !== rootJobId && itemJobId !== `${rootJobId}-ocr`;
          }),
        };
      },
      // Soft reset: chỉ reset cursor phân trang, giữ items hiện tại.
      // Cách cũ items:[] làm silent/full reload khiến cả lưới rỗng trước khi request trả về (gốc gây nhấp nháy trang chủ).
      // Khi dữ liệu mới tới, setItems / commitRecentJobsEmpty sẽ thay thế nguyên tử.
      resetPagination(currentState) {
        return {
          ...currentState,
          offset: 0,
          hasMore: true,
        };
      },
    },
  });
}

export function createRecentJobsStatePort(
  targetState: RecentJobsInitialState = {},
): RecentJobsStatePort {
  const store = createRecentJobsStore(targetState);
  const actions: BoundStoreActions<RecentJobsState, RecentJobsActions> = store.actions;

  function getSnapshot(): RecentJobsState {
    return store.getSnapshot();
  }

  function setOffset(value?: unknown) {
    actions.setOffset(value);
  }

  function setHasMore(value?: unknown) {
    actions.setHasMore(value);
  }

  function setItems(items?: unknown) {
    actions.setItems(items);
  }

  function setInvocationSummary(invocationSummary?: unknown) {
    actions.setInvocationSummary(invocationSummary);
  }

  function replaceItem(item?: LibraryJobItem | null) {
    actions.replaceItem(item);
  }

  function prependItem(item?: LibraryJobItem | null) {
    actions.prependItem(item);
  }

  function removeJobFamily(jobId?: unknown) {
    actions.removeJobFamily(jobId);
  }

  function resetPagination() {
    actions.resetPagination();
  }

  function batch(callback?: (api: RecentJobsBatchApi) => void): RecentJobsState {
    if (typeof callback !== "function") {
      return getSnapshot();
    }
    store.batch(({ actions: batchActions }) => {
      callback({
        actions: batchActions,
        getSnapshot,
        setHasMore: batchActions.setHasMore,
        setInvocationSummary: batchActions.setInvocationSummary,
        setItems: batchActions.setItems,
        setOffset: batchActions.setOffset,
        replaceItem: batchActions.replaceItem,
        prependItem: batchActions.prependItem,
        removeJobFamily: batchActions.removeJobFamily,
      });
    });
    return getSnapshot();
  }

  return {
    batch,
    getSnapshot,
    prependItem,
    removeJobFamily,
    replaceItem,
    resetPagination,
    setHasMore,
    setInvocationSummary,
    setItems,
    setOffset,
    subscribe: store.subscribe,
    store,
  };
}

let defaultRecentJobsStatePort: RecentJobsStatePort | null = null;

function getDefaultRecentJobsStatePort(): RecentJobsStatePort {
  if (!defaultRecentJobsStatePort) {
    defaultRecentJobsStatePort = createRecentJobsStatePort();
  }
  return defaultRecentJobsStatePort;
}

export function getRecentJobsState(): RecentJobsState {
  return getDefaultRecentJobsStatePort().getSnapshot();
}

export function setRecentJobsOffset(value?: unknown) {
  getDefaultRecentJobsStatePort().setOffset(value);
}

export function setRecentJobsHasMore(value?: unknown) {
  getDefaultRecentJobsStatePort().setHasMore(value);
}

export function setRecentJobsItems(items?: unknown) {
  getDefaultRecentJobsStatePort().setItems(items);
}

export function resetRecentJobsPagination() {
  getDefaultRecentJobsStatePort().resetPagination();
}
