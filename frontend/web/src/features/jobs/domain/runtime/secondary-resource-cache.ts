import { createStore, type Store } from "@/platform/store/store.js";
import type { ManifestPayload } from "@retainpdf/domain/job";

export const SECONDARY_RESOURCE_TYPES = Object.freeze([
  "events",
  "manifest",
  "stageActions",
] as const);

export type SecondaryResourceType = (typeof SECONDARY_RESOURCE_TYPES)[number];

/** Cached payload for one secondary resource (events / manifest / stageActions). */
export interface SecondaryResourceRecord {
  payload: unknown;
  jobId: string;
  fetchedAt: number;
  inFlight: boolean;
  ownerGen: number | string | null;
}

export type SecondaryResourcesState = {
  [K in SecondaryResourceType]: SecondaryResourceRecord;
};

/** Flat host-state fields that seed secondary resource records. */
export interface SecondaryResourceHostState {
  currentJobId?: string;
  currentJobEvents?: unknown;
  currentJobEventsJobId?: string;
  currentJobEventsFetchedAt?: number;
  currentJobEventsFetchInFlight?: boolean;
  currentJobManifest?: ManifestPayload | null;
  currentJobManifestJobId?: string;
  currentJobManifestFetchedAt?: number;
  currentJobManifestFetchInFlight?: boolean;
  currentJobStageActions?: unknown;
  currentJobStageActionsJobId?: string;
  currentJobStageActionsFetchedAt?: number;
  currentJobStageActionsFetchInFlight?: boolean;
  [key: string]: unknown;
}

interface SecondaryResourceFieldMap {
  payload: string;
  jobId: string;
  fetchedAt: string;
  inFlight: string;
}

export interface SecondaryResourceStatePortOptions {
  now?: () => number;
}

export interface SecondaryResourceResetOptions {
  preserveInFlight?: boolean;
}

export type SecondaryResourceActions = {
  setInFlight(
    currentState: SecondaryResourcesState,
    type: SecondaryResourceType | string,
    value: unknown,
    ownerGen?: number | string | null,
  ): SecondaryResourcesState;
  cache(
    currentState: SecondaryResourcesState,
    type: SecondaryResourceType | string,
    jobId: unknown,
    payload: unknown,
    fetchedAt: unknown,
    ownerGen?: number | string | null,
  ): SecondaryResourcesState;
  clearForOtherJob(
    currentState: SecondaryResourcesState,
    type: SecondaryResourceType | string,
    jobId: unknown,
  ): SecondaryResourcesState;
  reset(currentState: SecondaryResourcesState): SecondaryResourcesState;
  resetWithInFlight(currentState: SecondaryResourcesState): SecondaryResourcesState;
};

export type SecondaryResourceStore = Store<SecondaryResourcesState, SecondaryResourceActions>;

export interface SecondaryResourceBatchApi {
  actions: SecondaryResourceStore["actions"];
  cache: (type: SecondaryResourceType | string, jobId: unknown, payload: unknown, ownerGen?: number | string | null) => SecondaryResourcesState;
  clearForOtherJob: SecondaryResourceStore["actions"]["clearForOtherJob"];
  getSnapshot: () => SecondaryResourcesState;
  setInFlight: (type: SecondaryResourceType | string, value: unknown, ownerGen?: number | string | null) => SecondaryResourcesState;
}

export interface SecondaryResourceStatePort {
  store: SecondaryResourceStore;
  batch: (callback?: (api: SecondaryResourceBatchApi) => unknown) => unknown;
  getSnapshot: () => SecondaryResourcesState;
  isInFlight: (type: SecondaryResourceType | string) => boolean;
  fetchedAt: (type: SecondaryResourceType | string) => number;
  shouldRefresh: (type: SecondaryResourceType | string, intervalMs: number, force?: boolean) => boolean;
  setInFlight: (type: SecondaryResourceType | string, value: unknown, ownerGen?: number | string | null) => SecondaryResourcesState;
  clearInFlightForCurrentJob: (
    type: SecondaryResourceType | string,
    jobId: unknown,
    ownerGen?: number | string | null,
  ) => SecondaryResourcesState;
  cache: (
    type: SecondaryResourceType | string,
    jobId: unknown,
    payload: unknown,
    ownerGen?: number | string | null,
  ) => SecondaryResourcesState;
  clearForOtherJob: (
    type: SecondaryResourceType | string,
    jobId: unknown,
  ) => SecondaryResourcesState;
  cachedFor: (type: SecondaryResourceType | string, jobId: unknown) => unknown;
  sync: (
    type: SecondaryResourceType | string,
    jobId: unknown,
    payload: unknown,
  ) => unknown;
  reset: (options?: SecondaryResourceResetOptions) => SecondaryResourcesState;
}

const SECONDARY_RESOURCE_STORE_KEY = Symbol.for("retainpdf.secondaryResourceStore");

const SECONDARY_RESOURCE_FIELDS = Object.freeze({
  events: {
    payload: "currentJobEvents",
    jobId: "currentJobEventsJobId",
    fetchedAt: "currentJobEventsFetchedAt",
    inFlight: "currentJobEventsFetchInFlight",
  },
  manifest: {
    payload: "currentJobManifest",
    jobId: "currentJobManifestJobId",
    fetchedAt: "currentJobManifestFetchedAt",
    inFlight: "currentJobManifestFetchInFlight",
  },
  stageActions: {
    payload: "currentJobStageActions",
    jobId: "currentJobStageActionsJobId",
    fetchedAt: "currentJobStageActionsFetchedAt",
    inFlight: "currentJobStageActionsFetchInFlight",
  },
} as const satisfies Record<SecondaryResourceType, SecondaryResourceFieldMap>);

function secondaryResourceFields(type: SecondaryResourceType | string): SecondaryResourceFieldMap | null {
  return (SECONDARY_RESOURCE_FIELDS as Record<string, SecondaryResourceFieldMap>)[type] || null;
}

function emptySecondaryResourceRecord(): SecondaryResourceRecord {
  return {
    payload: null,
    jobId: "",
    fetchedAt: 0,
    inFlight: false,
    ownerGen: null,
  };
}

function normalizeSecondaryResourceRecord(
  initialState: SecondaryResourceHostState = {},
  type: SecondaryResourceType | string,
): SecondaryResourceRecord {
  const fields = secondaryResourceFields(type);
  if (!fields) {
    return emptySecondaryResourceRecord();
  }
  return {
    payload: initialState[fields.payload] ?? null,
    jobId: `${initialState[fields.jobId] || ""}`.trim(),
    fetchedAt: Number(initialState[fields.fetchedAt] || 0),
    inFlight: Boolean(initialState[fields.inFlight]),
    ownerGen: null,
  };
}

function normalizeSecondaryResourcesState(
  initialState: SecondaryResourceHostState = {},
): SecondaryResourcesState {
  return Object.fromEntries(
    SECONDARY_RESOURCE_TYPES.map((type) => [
      type,
      normalizeSecondaryResourceRecord(initialState, type),
    ]),
  ) as SecondaryResourcesState;
}

export function createSecondaryResourceStore(
  initialState: SecondaryResourceHostState = {},
): SecondaryResourceStore {
  return createStore<SecondaryResourcesState, SecondaryResourceActions>({
    name: "secondaryResources",
    initialState: normalizeSecondaryResourcesState(initialState),
    actions: {
      setInFlight(currentState, type, value, ownerGen = undefined) {
        if (!secondaryResourceFields(type)) {
          return currentState;
        }
        const current = currentState[type as SecondaryResourceType] || emptySecondaryResourceRecord();
        const on = Boolean(value);
        // 异 gen 不清不覆：携带 ownerGen 的关断只允许同 gen 执行。
        if (!on && ownerGen !== undefined && current.ownerGen !== null && current.ownerGen !== undefined
          && ownerGen !== current.ownerGen) {
          return currentState;
        }
        return {
          ...currentState,
          [type]: {
            ...(currentState[type as SecondaryResourceType] || emptySecondaryResourceRecord()),
            inFlight: on,
            ownerGen: on
              ? (ownerGen !== undefined ? (ownerGen as number | string | null) : null)
              : null,
          },
        };
      },
      cache(currentState, type, jobId, payload, fetchedAt, ownerGen = undefined) {
        if (!secondaryResourceFields(type)) {
          return currentState;
        }
        const current = currentState[type as SecondaryResourceType] || emptySecondaryResourceRecord();
        // 异 gen 不覆：已有属主且来者 gen 不同时直接丢弃。
        if (ownerGen !== undefined && current.ownerGen !== null && current.ownerGen !== undefined
          && ownerGen !== current.ownerGen) {
          return currentState;
        }
        return {
          ...currentState,
          [type]: {
            payload,
            jobId: `${jobId || ""}`.trim(),
            fetchedAt: Number(fetchedAt || 0),
            inFlight: Boolean(currentState[type as SecondaryResourceType]?.inFlight),
            ownerGen: current.ownerGen ?? null,
          },
        };
      },
      clearForOtherJob(currentState, type, jobId) {
        if (!secondaryResourceFields(type)) {
          return currentState;
        }
        const current = currentState[type as SecondaryResourceType] || emptySecondaryResourceRecord();
        const normalizedJobId = `${jobId || ""}`.trim();
        if (!current.jobId || current.jobId === normalizedJobId) {
          return currentState;
        }
        return {
          ...currentState,
          [type]: {
            ...emptySecondaryResourceRecord(),
            inFlight: Boolean(current.inFlight),
            ownerGen: current.ownerGen ?? null,
          },
        };
      },
      reset(currentState) {
        return Object.fromEntries(
          SECONDARY_RESOURCE_TYPES.map((type) => [
            type,
            {
              ...emptySecondaryResourceRecord(),
              inFlight: Boolean(currentState[type]?.inFlight),
              ownerGen: currentState[type]?.ownerGen ?? null,
            },
          ]),
        ) as SecondaryResourcesState;
      },
      resetWithInFlight(currentState) {
        return currentState;
      },
    },
  });
}

function asHostBag(state: object): SecondaryResourceHostState {
  return state as SecondaryResourceHostState;
}

function storeSlot(state: object): SecondaryResourceStore | undefined {
  return (state as Record<PropertyKey, unknown>)[SECONDARY_RESOURCE_STORE_KEY] as
    | SecondaryResourceStore
    | undefined;
}

export function secondaryResourceStoreFor(
  state: object | null | undefined,
): SecondaryResourceStore {
  if (!state || typeof state !== "object") {
    return createSecondaryResourceStore();
  }
  const existing = storeSlot(state);
  if (!existing) {
    Object.defineProperty(state, SECONDARY_RESOURCE_STORE_KEY, {
      configurable: false,
      enumerable: false,
      value: createSecondaryResourceStore(asHostBag(state)),
      writable: false,
    });
  }
  return storeSlot(state) as SecondaryResourceStore;
}

function applySecondaryResourceAction(
  state: object,
  action: (store: SecondaryResourceStore) => SecondaryResourcesState,
): SecondaryResourcesState {
  const store = secondaryResourceStoreFor(state);
  return action(store);
}

export function createSecondaryResourceStatePort(
  state: object,
  {
    now = () => Date.now(),
  }: SecondaryResourceStatePortOptions = {},
): SecondaryResourceStatePort {
  const host = asHostBag(state);
  const store = secondaryResourceStoreFor(state);
  function applyBatch(callback?: (api: SecondaryResourceBatchApi) => unknown) {
    if (typeof callback !== "function") {
      return store.getSnapshot();
    }
    const result = store.batch(({ actions }) => callback({
      actions,
      cache: (type, jobId, payload, ownerGen) => actions.cache(type, jobId, payload, now(), ownerGen),
      clearForOtherJob: actions.clearForOtherJob,
      getSnapshot: () => store.getSnapshot(),
      setInFlight: (type, value, ownerGen) => actions.setInFlight(type, value, ownerGen),
    }));
    return result;
  }
  return {
    store,
    batch: applyBatch,
    getSnapshot: () => store.getSnapshot(),
    isInFlight(type) {
      const record = store.getSnapshot()[type as SecondaryResourceType];
      return Boolean(record?.inFlight);
    },
    fetchedAt(type) {
      const record = store.getSnapshot()[type as SecondaryResourceType];
      return Number(record?.fetchedAt || 0);
    },
    shouldRefresh(type, intervalMs, force = false) {
      return shouldRefreshSecondary(this.fetchedAt(type), intervalMs, force);
    },
    setInFlight(type, value, ownerGen = undefined) {
      return applySecondaryResourceAction(
        state,
        (currentStore) => currentStore.actions.setInFlight(type, value, ownerGen),
      );
    },
    clearInFlightForCurrentJob(type, jobId, ownerGen = undefined) {
      const record = store.getSnapshot()[type as SecondaryResourceType];
      if (record?.jobId === jobId) {
        return this.setInFlight(type, false, ownerGen);
      }
      return store.getSnapshot();
    },
    cache(type, jobId, payload, ownerGen = undefined) {
      return applySecondaryResourceAction(
        state,
        (currentStore) => currentStore.actions.cache(type, jobId, payload, now(), ownerGen),
      );
    },
    clearForOtherJob(type, jobId) {
      return applySecondaryResourceAction(
        state,
        (currentStore) => currentStore.actions.clearForOtherJob(type, jobId),
      );
    },
    cachedFor(type, jobId) {
      const record = store.getSnapshot()[type as SecondaryResourceType];
      return record?.jobId === jobId ? record.payload : null;
    },
    sync(type, jobId, payload) {
      if (payload === null) {
        this.clearForOtherJob(type, jobId);
        return this.cachedFor(type, jobId);
      }
      this.cache(type, jobId, payload);
      return this.cachedFor(type, jobId);
    },
    reset({ preserveInFlight = false }: SecondaryResourceResetOptions = {}) {
      const current = store.getSnapshot();
      const next = Object.fromEntries(
        SECONDARY_RESOURCE_TYPES.map((type) => [
          type,
          {
            ...emptySecondaryResourceRecord(),
            inFlight: preserveInFlight ? Boolean(current[type]?.inFlight) : false,
            ownerGen: preserveInFlight ? (current[type]?.ownerGen ?? null) : null,
          },
        ]),
      ) as SecondaryResourcesState;
      return store.reset(next);
    },
  };
}

export function resetSecondaryResourceState(
  state: unknown,
  options: SecondaryResourceResetOptions = {},
) {
  return createSecondaryResourceStatePort(state as object).reset(options);
}

export function isSecondaryFetchInFlight(
  state: unknown,
  type: SecondaryResourceType | string,
) {
  return createSecondaryResourceStatePort(state as object).isInFlight(type);
}

export function secondaryResourceFetchedAt(
  state: unknown,
  type: SecondaryResourceType | string,
) {
  return createSecondaryResourceStatePort(state as object).fetchedAt(type);
}

export function setSecondaryFetchInFlight(
  state: unknown,
  type: SecondaryResourceType | string,
  value: unknown,
) {
  createSecondaryResourceStatePort(state as object).setInFlight(type, value);
}

export function clearSecondaryFetchInFlightForCurrentJob(
  state: unknown,
  type: SecondaryResourceType | string,
  jobId: unknown,
) {
  createSecondaryResourceStatePort(state as object).clearInFlightForCurrentJob(type, jobId);
}

export function cacheSecondaryResource(
  state: unknown,
  type: SecondaryResourceType | string,
  jobId: unknown,
  payload: unknown,
) {
  createSecondaryResourceStatePort(state as object).cache(type, jobId, payload);
}

export function clearSecondaryResourceForOtherJob(
  state: unknown,
  type: SecondaryResourceType | string,
  jobId: unknown,
) {
  createSecondaryResourceStatePort(state as object).clearForOtherJob(type, jobId);
}

export function cachedSecondaryResourceFor(
  state: unknown,
  type: SecondaryResourceType | string,
  jobId: unknown,
) {
  return createSecondaryResourceStatePort(state as object).cachedFor(type, jobId);
}

export function syncSecondaryResource(
  state: unknown,
  type: SecondaryResourceType | string,
  jobId: unknown,
  payload: unknown,
) {
  return createSecondaryResourceStatePort(state as object).sync(type, jobId, payload);
}

export function cachedEventsFor(state: unknown, jobId: unknown) {
  return cachedSecondaryResourceFor(state, "events", jobId);
}

export function cachedManifestFor(state: unknown, jobId: unknown): ManifestPayload | null {
  const payload = cachedSecondaryResourceFor(state, "manifest", jobId);
  return payload && typeof payload === "object"
    ? (payload as ManifestPayload)
    : null;
}

export function cachedStageActionsFor(state: unknown, jobId: unknown) {
  return cachedSecondaryResourceFor(state, "stageActions", jobId);
}

export function shouldRefreshSecondary(
  lastFetchedAt: number,
  refreshMs: number,
  force: boolean,
) {
  if (force) {
    return true;
  }
  if (!Number.isFinite(lastFetchedAt) || lastFetchedAt <= 0) {
    return true;
  }
  return (Date.now() - lastFetchedAt) >= refreshMs;
}
