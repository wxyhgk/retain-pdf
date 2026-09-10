// 主页视图状态契约：常量 + 型别，无实现。
//
// store 实现（createHomeStore / createHomeStatePort）在
// src/app/home/state/home-store.ts —— 那是装配层。features/{ingest,library} 只
// 需要 HomeStatePort 的形状来声明可选依赖，把型别留在 platform/contracts、实现留在
// app/，features → platform 合法，features → app 的违规就不会出现。
// （蓝图 §4.4 原写「js/features/home 整体归 app/home」，那会让 4 处 import type
//  变成 features → app 反向依赖，故按归属拆开。）

import type { Store } from "../store/store.js";

export const HOME_VIEW_MODES = Object.freeze({
  LIBRARY: "library",
  WORKFLOW_UPLOAD: "workflow_upload",
  WORKFLOW_STATUS: "workflow_status",
});

export const HOME_LOADING_STATES = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
});

export type HomeViewMode = (typeof HOME_VIEW_MODES)[keyof typeof HOME_VIEW_MODES];
export type HomeLoadingState = (typeof HOME_LOADING_STATES)[keyof typeof HOME_LOADING_STATES];

export interface HomeState {
  viewMode: HomeViewMode;
  recentJobsLoadingState: HomeLoadingState;
  recentJobsError: string;
}

/** 兼容旧扁平字段名的初始态 */
export type HomeInitialState = Partial<HomeState> & {
  homeViewMode?: HomeViewMode | string;
  homeRecentJobsLoadingState?: HomeLoadingState | string;
  homeRecentJobsError?: string;
};

export interface CreateHomeStatePortOptions {
  // 遗留字段：事件已删（store 是唯一真值），保留签名兼容调用方。
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
