import { createStore, type Store } from "../../app-framework/store.js";
import type { JobLike, JobPayload } from "../../job/types.js";
export {
  currentJobEventsFor,
  currentJobManifest,
  currentJobStageActions,
} from "./current-job-secondary-selectors.js";

const CURRENT_JOB_STORE_KEY = Symbol.for("retainpdf.currentJobStore");

/** Normalized current-job sub-store snapshot. */
export interface CurrentJobStoreState {
  jobId: string;
  snapshot: JobLike | JobPayload | null;
  startedAt: string;
  finishedAt: string;
  diagnostics: unknown;
  diagnosticsJobId: string;
  resumePlan: unknown;
  resumePlanJobId: string;
}

/** Host-state or partial fields accepted when seeding the store. */
export type CurrentJobInitialState = Partial<CurrentJobStoreState> & {
  currentJobId?: string;
  currentJobSnapshot?: JobLike | JobPayload | null;
  currentJobStartedAt?: string;
  currentJobFinishedAt?: string;
  currentJobDiagnostics?: unknown;
  currentJobDiagnosticsJobId?: string;
  currentJobResumePlan?: unknown;
  currentJobResumePlanJobId?: string;
  [key: string]: unknown;
};

export interface CurrentJobSyncMeta {
  startedAt?: string;
  finishedAt?: string;
}

export type CurrentJobActions = {
  syncSnapshot(
    currentState: CurrentJobStoreState,
    job: JobLike | JobPayload | null | undefined,
    jobId: unknown,
    meta?: CurrentJobSyncMeta,
  ): CurrentJobStoreState;
  clearTiming(currentState: CurrentJobStoreState): CurrentJobStoreState;
  cacheDiagnostics(
    currentState: CurrentJobStoreState,
    jobId: unknown,
    payload: unknown,
  ): CurrentJobStoreState;
  cacheResumePlan(
    currentState: CurrentJobStoreState,
    jobId: unknown,
    payload: unknown,
  ): CurrentJobStoreState;
};

export type CurrentJobStore = Store<CurrentJobStoreState, CurrentJobActions>;

export interface CurrentJobBatchApi {
  actions: CurrentJobStore["actions"];
  cacheDiagnostics: CurrentJobStore["actions"]["cacheDiagnostics"];
  cacheResumePlan: CurrentJobStore["actions"]["cacheResumePlan"];
  clearTiming: CurrentJobStore["actions"]["clearTiming"];
  getSnapshot: () => CurrentJobStoreState;
  syncSnapshot: CurrentJobStore["actions"]["syncSnapshot"];
}

export interface CurrentJobStatePort {
  store: CurrentJobStore;
  batch: (callback?: (api: CurrentJobBatchApi) => unknown) => unknown;
  getSnapshot: () => CurrentJobStoreState;
  jobId: () => string;
  snapshot: () => JobLike | JobPayload | null;
  snapshotFor: (jobId: unknown) => JobLike | JobPayload | null;
  finishedAt: () => string;
  resumePlan: () => unknown;
  syncSnapshot: (
    job: unknown,
    jobId: unknown,
    meta?: CurrentJobSyncMeta,
  ) => CurrentJobStoreState;
  clearTiming: () => CurrentJobStoreState;
  cacheDiagnostics: (jobId: unknown, payload: unknown) => CurrentJobStoreState;
  cacheResumePlan: (jobId: unknown, payload: unknown) => CurrentJobStoreState;
}

export function createCurrentJobStore(
  initialState: CurrentJobInitialState = {},
): CurrentJobStore {
  return createStore<CurrentJobStoreState, CurrentJobActions>({
    name: "currentJob",
    initialState: {
      jobId: `${initialState.jobId ?? initialState.currentJobId ?? ""}`.trim(),
      snapshot: (initialState.snapshot ?? initialState.currentJobSnapshot ?? null) as
        | JobLike
        | JobPayload
        | null,
      startedAt: `${initialState.startedAt ?? initialState.currentJobStartedAt ?? ""}`.trim(),
      finishedAt: `${initialState.finishedAt ?? initialState.currentJobFinishedAt ?? ""}`.trim(),
      diagnostics: initialState.diagnostics ?? initialState.currentJobDiagnostics ?? null,
      diagnosticsJobId: `${initialState.diagnosticsJobId ?? initialState.currentJobDiagnosticsJobId ?? ""}`.trim(),
      resumePlan: initialState.resumePlan ?? initialState.currentJobResumePlan ?? null,
      resumePlanJobId: `${initialState.resumePlanJobId ?? initialState.currentJobResumePlanJobId ?? ""}`.trim(),
    },
    actions: {
      syncSnapshot(currentState, job, jobId, meta: CurrentJobSyncMeta = {}) {
        return {
          ...currentState,
          jobId: `${jobId || ""}`.trim(),
          snapshot: job || null,
          startedAt: `${meta.startedAt || ""}`.trim(),
          finishedAt: `${meta.finishedAt || ""}`.trim(),
        };
      },
      clearTiming(currentState) {
        return {
          ...currentState,
          startedAt: "",
          finishedAt: "",
        };
      },
      cacheDiagnostics(currentState, jobId, payload) {
        return {
          ...currentState,
          diagnostics: payload,
          diagnosticsJobId: `${jobId || ""}`.trim(),
        };
      },
      cacheResumePlan(currentState, jobId, payload) {
        return {
          ...currentState,
          resumePlan: payload,
          resumePlanJobId: `${jobId || ""}`.trim(),
        };
      },
    },
  });
}

function asCurrentJobHost(state: object): CurrentJobInitialState {
  return state as CurrentJobInitialState;
}

function currentJobStoreSlot(state: object): CurrentJobStore | undefined {
  return (state as Record<PropertyKey, unknown>)[CURRENT_JOB_STORE_KEY] as
    | CurrentJobStore
    | undefined;
}

export function currentJobStoreFor(
  state: object | null | undefined,
): CurrentJobStore {
  if (!state || typeof state !== "object") {
    return createCurrentJobStore();
  }
  const existing = currentJobStoreSlot(state);
  if (!existing) {
    Object.defineProperty(state, CURRENT_JOB_STORE_KEY, {
      configurable: false,
      enumerable: false,
      value: createCurrentJobStore(asCurrentJobHost(state)),
      writable: false,
    });
  }
  return currentJobStoreSlot(state) as CurrentJobStore;
}

function applyCurrentJobAction(
  state: object,
  action: (store: CurrentJobStore) => CurrentJobStoreState,
): CurrentJobStoreState {
  const store = currentJobStoreFor(state);
  return action(store);
}

export function createCurrentJobStatePort(
  state: object,
): CurrentJobStatePort {
  const store = currentJobStoreFor(state);
  function applyBatch(callback?: (api: CurrentJobBatchApi) => unknown) {
    if (typeof callback !== "function") {
      return store.getSnapshot();
    }
    return store.batch(({ actions }) => callback({
      actions,
      cacheDiagnostics: actions.cacheDiagnostics,
      cacheResumePlan: actions.cacheResumePlan,
      clearTiming: actions.clearTiming,
      getSnapshot: () => store.getSnapshot(),
      syncSnapshot: actions.syncSnapshot,
    }));
  }
  return {
    store,
    batch: applyBatch,
    getSnapshot: () => store.getSnapshot(),
    jobId: () => store.getSnapshot().jobId,
    snapshot: () => store.getSnapshot().snapshot,
    snapshotFor: (jobId) => {
      const snapshot = store.getSnapshot();
      return snapshot.jobId === jobId ? snapshot.snapshot : null;
    },
    finishedAt: () => store.getSnapshot().finishedAt,
    resumePlan: () => {
      const snapshot = store.getSnapshot();
      return snapshot.jobId && snapshot.resumePlanJobId === snapshot.jobId
        ? snapshot.resumePlan || null
        : null;
    },
    syncSnapshot: (job, jobId, meta: CurrentJobSyncMeta = {}) => applyCurrentJobAction(
      state,
      (currentStore) => currentStore.actions.syncSnapshot(
        job as JobLike | JobPayload | null | undefined,
        jobId,
        meta,
      ),
    ),
    clearTiming: () => applyCurrentJobAction(
      state,
      (currentStore) => currentStore.actions.clearTiming(),
    ),
    cacheDiagnostics: (jobId, payload) => applyCurrentJobAction(
      state,
      (currentStore) => currentStore.actions.cacheDiagnostics(jobId, payload),
    ),
    cacheResumePlan: (jobId, payload) => applyCurrentJobAction(
      state,
      (currentStore) => currentStore.actions.cacheResumePlan(jobId, payload),
    ),
  };
}

// Trình đọc bộ chọn store Ảnh chụp nhanh(store là giá trị thực duy nhất,trước đây state Đối tượng chỉ hoạt động như một khóa nhận dạng)
export function currentJobId(state?: unknown) {
  return `${currentJobStoreFor(state as object | null | undefined).getSnapshot().jobId || ""}`.trim();
}

export function currentJobSnapshot(state?: unknown) {
  return currentJobStoreFor(state as object | null | undefined).getSnapshot().snapshot || null;
}

export function currentJobFinishedAt(state?: unknown) {
  return `${currentJobStoreFor(state as object | null | undefined).getSnapshot().finishedAt || ""}`.trim();
}

export function currentJobSnapshotFor(state: unknown, jobId: unknown) {
  const snapshot = currentJobStoreFor(state as object | null | undefined).getSnapshot();
  return snapshot.jobId === jobId ? snapshot.snapshot : null;
}

export function syncCurrentJobSnapshot(
  state: unknown,
  job: unknown,
  jobId: unknown,
  {
    startedAt = "",
    finishedAt = "",
  }: CurrentJobSyncMeta = {},
) {
  createCurrentJobStatePort(state as object).syncSnapshot(
    job as JobLike | JobPayload | null | undefined,
    jobId,
    { startedAt, finishedAt },
  );
}

export function clearCurrentJobTiming(state: unknown) {
  createCurrentJobStatePort(state as object).clearTiming();
}

export function cacheJobDiagnostics(
  state: unknown,
  jobId: unknown,
  payload: unknown,
) {
  createCurrentJobStatePort(state as object).cacheDiagnostics(jobId, payload);
}

export function cacheJobResumePlan(
  state: unknown,
  jobId: unknown,
  payload: unknown,
) {
  createCurrentJobStatePort(state as object).cacheResumePlan(jobId, payload);
}
