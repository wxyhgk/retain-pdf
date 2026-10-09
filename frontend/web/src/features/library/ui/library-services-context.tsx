// 书架的服务（动作、网格视图端口、列表 store）由本功能自带的 context 下发，
// 书籍详情、上传等其它功能从本功能的出口取。页面（HomeApp）在最外层提供一次。
//
// 以前挂在 ui/context 的窄口上：ui 层不许 import 功能类型，动作和视图端口只能写 any，
// 消费方要么到处 `as` 回来，要么干脆不知道能调什么。

import { createContext, createElement, useContext } from "react";
import type { ReactNode } from "react";

import type { LibraryActions, RecentJobsReactViewPort } from "../domain/types.js";
import type { RecentJobsStatePort } from "../domain/recent-jobs/state.js";

export type LibraryServices = {
  actions: LibraryActions;
  viewPort: RecentJobsReactViewPort;
  recentJobsStore: RecentJobsStatePort["store"];
};

const LibraryServicesContext = createContext<LibraryServices | null>(null);

export function LibraryServicesProvider({ value, children }: { value: LibraryServices; children: ReactNode }) {
  return createElement(LibraryServicesContext.Provider, { value }, children);
}

export function useLibraryServices(): LibraryServices {
  const value = useContext(LibraryServicesContext);
  if (!value) throw new Error("useLibraryServices 需要外层 LibraryServicesProvider");
  return value;
}
