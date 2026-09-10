// 组合根下发通道:单个页级 Context(总计划「状态策略」第 3 条)。
// entry.jsx 先建 composition,再经 <HomeServicesProvider> 灌给组件树;
// Shell 层(TopBar/BottomBar/home-paper-stage)只取窄口,不大包直取。
//
// HomeShellProviders:providers 嵌套——外层保留 HomeServicesProvider(深层
// features 经 useHomeServices 照旧消费),内层按域拆出 dialog/statusArea/
// workflowDialog/settingsHub 窄 Context,供 Shell 直取,避免 Shell 成为
// services 大包的中转站。HomeTabsProvider 承载 tabs 本地态(?tab= 同步在
// HomeApp 维护,见 HomeApp.tsx)。

import { createContext, createElement, useContext } from "react";
import type { ReactNode } from "react";
import type { HomeServices } from "./composition/types.js";

export const HomeServicesContext = createContext<HomeServices | null>(null);
export const HomeServicesProvider = HomeServicesContext.Provider;

export function useHomeServices(): HomeServices {
  const services = useContext(HomeServicesContext);
  if (!services) {
    throw new Error("useHomeServices 必须在 <HomeServicesProvider> 内使用(entry.jsx 先建 composition)");
  }
  return services;
}

// ── Shell 窄域 Context(由 HomeShellProviders 按 services 一次灌入) ──

const DialogStoreContext = createContext<HomeServices["stores"]["dialog"] | null>(null);
const StatusAreaStoreContext = createContext<HomeServices["stores"]["statusArea"] | null>(null);
const WorkflowDialogContext = createContext<HomeServices["workflowDialog"] | null>(null);
const SettingsHubContext = createContext<HomeServices["settingsHub"] | null>(null);

function narrowOrBag<T>(narrow: T | null, pick: (s: HomeServices) => T, name: string): T {
  if (narrow) return narrow;
  // 兼容单挂 HomeServicesProvider 的旧挂载(孤立渲染 BottomBar 的测试)——
  // Shell 正常路径经 HomeShellProviders 灌入,不走这条回退。
  const bag = useContext(HomeServicesContext);
  if (!bag) throw new Error(`${name} 必须在 <HomeShellProviders> 内使用`);
  return pick(bag);
}

export function useHomeDialogStore(): HomeServices["stores"]["dialog"] {
  return narrowOrBag(useContext(DialogStoreContext), (s) => s.stores.dialog, "useHomeDialogStore");
}

export function useHomeStatusAreaStore(): HomeServices["stores"]["statusArea"] {
  return narrowOrBag(useContext(StatusAreaStoreContext), (s) => s.stores.statusArea, "useHomeStatusAreaStore");
}

export function useHomeWorkflowDialog(): HomeServices["workflowDialog"] {
  return narrowOrBag(useContext(WorkflowDialogContext), (s) => s.workflowDialog, "useHomeWorkflowDialog");
}

export function useHomeSettingsHub(): HomeServices["settingsHub"] {
  return narrowOrBag(useContext(SettingsHubContext), (s) => s.settingsHub, "useHomeSettingsHub");
}

export function HomeShellProviders({ services, children }: { services: HomeServices; children: ReactNode }) {
  return createElement(
    HomeServicesProvider,
    { value: services },
    createElement(
      DialogStoreContext.Provider,
      { value: services.stores.dialog },
      createElement(
        StatusAreaStoreContext.Provider,
        { value: services.stores.statusArea },
        createElement(
          WorkflowDialogContext.Provider,
          { value: services.workflowDialog },
          createElement(SettingsHubContext.Provider, { value: services.settingsHub }, children),
        ),
      ),
    ),
  );
}

// ── Tabs 本地态 Context(tabs 切页只改本地 state + URL ?tab=,不碰 store) ──

export type HomeTabsValue = {
  activeTab: string;
  onTabChange: (tab: string) => void;
};

export const HomeTabsContext = createContext<HomeTabsValue | null>(null);
export const HomeTabsProvider = HomeTabsContext.Provider;

export function useHomeTabs(): HomeTabsValue {
  const tabs = useContext(HomeTabsContext);
  if (!tabs) {
    throw new Error("useHomeTabs 必须在 <HomeTabsProvider> 内使用(HomeApp 维护 tabs 本地态)");
  }
  return tabs;
}
