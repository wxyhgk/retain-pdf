import {
  createStore,
  type BoundStoreActions,
  type Store,
} from "../../app-framework/store.js";
import { APP_EVENTS } from "../../contracts/app-contract.js";
import {
  HOME_LOADING_STATES,
  HOME_VIEW_MODES,
} from "../../contracts/home-view-contract.js";

export { HOME_LOADING_STATES, HOME_VIEW_MODES };

export type HomeViewMode = (typeof HOME_VIEW_MODES)[keyof typeof HOME_VIEW_MODES];
export type HomeLoadingState = (typeof HOME_LOADING_STATES)[keyof typeof HOME_LOADING_STATES];

export interface HomeState {
  viewMode: HomeViewMode;
  recentJobsLoadingState: HomeLoadingState;
  recentJobsError: string;
}

/** Trạng thái ban đầu tương thích với tên trường phẳng cũ */
export type HomeInitialState = Partial<HomeState> & {
  homeViewMode?: HomeViewMode | string;
  homeRecentJobsLoadingState?: HomeLoadingState | string;
  homeRecentJobsError?: string;
};

export interface CreateHomeStatePortOptions {
  eventTarget?: {
    dispatchEvent?: (event: Event) => boolean;
  } | null;
}

export type HomeActions = {
  setViewMode(currentState: HomeState, mode?: unknown): HomeState;
  setRecentJobsLoadingState(
    currentState: HomeState,
    loadingState?: unknown,
    error?: string,
  ): HomeState;
};

export type HomeStore = Store<HomeState, HomeActions>;

export interface HomeStatePort {
  getSnapshot(): HomeState;
  setRecentJobsLoadingState(loadingState?: unknown, error?: string): void;
  setViewMode(mode?: string): void;
  store: HomeStore;
}

function normalizeHomeViewMode(mode: unknown): HomeViewMode {
  return (Object.values(HOME_VIEW_MODES) as string[]).includes(mode as string)
    ? (mode as HomeViewMode)
    : HOME_VIEW_MODES.LIBRARY;
}

function normalizeHomeLoadingState(loadingState: unknown): HomeLoadingState {
  return (Object.values(HOME_LOADING_STATES) as string[]).includes(loadingState as string)
    ? (loadingState as HomeLoadingState)
    : HOME_LOADING_STATES.IDLE;
}

export function createHomeStore(initialState: HomeInitialState = {}): HomeStore {
  return createStore<HomeState, HomeActions>({
    name: "home",
    initialState: {
      viewMode: normalizeHomeViewMode(initialState.viewMode
        ?? initialState.homeViewMode
        ?? HOME_VIEW_MODES.LIBRARY),
      recentJobsLoadingState: normalizeHomeLoadingState(initialState.recentJobsLoadingState
        ?? initialState.homeRecentJobsLoadingState
        ?? HOME_LOADING_STATES.IDLE),
      recentJobsError: `${initialState.recentJobsError ?? initialState.homeRecentJobsError ?? ""}`,
    },
    actions: {
      setViewMode(currentState, mode) {
        return {
          ...currentState,
          viewMode: normalizeHomeViewMode(mode),
        };
      },
      setRecentJobsLoadingState(currentState, loadingState, error = "") {
        return {
          ...currentState,
          recentJobsLoadingState: normalizeHomeLoadingState(loadingState),
          recentJobsError: `${error || ""}`,
        };
      },
    },
  });
}

function dispatchHomeEvent(
  eventTarget: CreateHomeStatePortOptions["eventTarget"],
  type: string,
  detail: Record<string, unknown>,
) {
  if (!eventTarget?.dispatchEvent || typeof globalThis.CustomEvent !== "function") {
    return;
  }
  eventTarget.dispatchEvent(new globalThis.CustomEvent(type, { detail }));
}

export function createHomeStatePort(
  targetState: HomeInitialState = {},
  { eventTarget = globalThis.document }: CreateHomeStatePortOptions = {},
): HomeStatePort {
  const store = createHomeStore(targetState);
  const actions: BoundStoreActions<HomeState, HomeActions> = store.actions;

  function setViewMode(mode?: string) {
    const snapshot = actions.setViewMode(mode);
    dispatchHomeEvent(eventTarget, APP_EVENTS.homeViewModeChanged, {
      mode: snapshot.viewMode,
    });
  }

  function setRecentJobsLoadingState(loadingState?: unknown, error = "") {
    const snapshot = actions.setRecentJobsLoadingState(loadingState, error);
    dispatchHomeEvent(eventTarget, APP_EVENTS.homeRecentJobsStateChanged, {
      loadingState: snapshot.recentJobsLoadingState,
      error: snapshot.recentJobsError,
    });
  }

  function getSnapshot(): HomeState {
    return store.getSnapshot();
  }

  return {
    getSnapshot,
    setRecentJobsLoadingState,
    setViewMode,
    store,
  };
}

let defaultHomeStatePort: HomeStatePort | null = null;

function getDefaultHomeStatePort(): HomeStatePort {
  if (!defaultHomeStatePort) {
    defaultHomeStatePort = createHomeStatePort();
  }
  return defaultHomeStatePort;
}

export function setHomeViewMode(mode?: string) {
  getDefaultHomeStatePort().setViewMode(mode);
}

export function setHomeRecentJobsLoadingState(loadingState?: unknown, error = "") {
  getDefaultHomeStatePort().setRecentJobsLoadingState(loadingState, error);
}

export function getHomeState(): HomeState {
  return getDefaultHomeStatePort().getSnapshot();
}
