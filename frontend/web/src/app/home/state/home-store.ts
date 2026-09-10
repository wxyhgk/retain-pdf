// 主页视图状态的 store 实现（原 src/js/features/home/state.ts 的下半段）。
//
// 型别与常量（HomeState / HomeStatePort / HOME_VIEW_MODES / HOME_LOADING_STATES）
// 在 @/platform/contracts/home-view-contract.js —— features/{ingest,library} 只
// import type 那一半，不会因此依赖装配层。本文件是唯一的实现方，只被 app/home
// 的组合根消费。
//
// createStore 经 composition/external 取（同目录 text-store / dialog-store /
// artifact-download-busy-store 的既有约定：app 层不直连 platform/store，
// architecture-boundaries 的防回弹门禁只豁免 features/*/domain）。
// 这里取 external/state.js 子桶而不是全量 external.js：external/index.js 会
// `export * from "./features.js"`，而 features.js 又转出本文件的 createHomeStatePort
// ——走全量桶会形成 features → home-store → external → features 的模块环。

import { createStore } from "@/platform/store/store.js";
import {
  HOME_LOADING_STATES,
  HOME_VIEW_MODES,
} from "@/platform/contracts/home-view-contract.js";
import type {
  CreateHomeStatePortOptions,
  HomeActions,
  HomeInitialState,
  HomeLoadingState,
  HomeState,
  HomeStatePort,
  HomeStore,
  HomeViewMode,
} from "@/platform/contracts/home-view-contract.js";

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

export function createHomeStatePort(
  targetState: HomeInitialState = {},
  _options: CreateHomeStatePortOptions = {},
): HomeStatePort {
  const store = createHomeStore(targetState);
  const actions = store.actions;

  function setViewMode(mode?: string) {
    // store 是唯一真值；旧 homeViewModeChanged 事件已删（0 消费者）。
    return actions.setViewMode(mode);
  }

  function setRecentJobsLoadingState(loadingState?: unknown, error = "") {
    // 同上：旧 homeRecentJobsStateChanged 事件已删，读 store 即可。
    return actions.setRecentJobsLoadingState(loadingState, error);
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
