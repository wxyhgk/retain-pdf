// 组合根下发通道:app 侧**适配层**。
// entry.jsx 先建 composition,再经 <HomeShellProviders> 把它按域映射成窄口值
// 灌给组件树;所有消费方(含 Shell 的 TopBar/BottomBar)一律走窄 hook。
//
// 窄 Context/hook/provider 本身住在 @/ui/context/home-services-context.js
// (平台/UI 侧,不 import app/features),所以功能可以 features → ui 消费,不必
// 回头 import app 的聚合类型(composition/types 汇总了所有功能类型,曾是
// 40 文件环的根)。
//
// 本文件现在只剩两件事:
//   1) 把窄口 hook 原样再转出,消费方的 import 路径不变;
//   2) toNarrowServices():用 composition 的 HomeServices 实例映射出窄口聚合。
// 泛型大包(useHomeServices / HomeServicesProvider)已退役,不再是第三条路。
// HomeTabsProvider 承载 tabs 本地态(?tab= 同步在 HomeApp 维护)。

import { createContext, createElement, useContext } from "react";
import type { Context } from "react";
import type { ReactNode } from "react";
import {
  HomeShellProviders as NarrowHomeShellProviders,
} from "@/ui/context/home-services-context.js";
import type { HomeNarrowServices } from "@/ui/context/home-services-context.js";
import type { HomeServices } from "./composition/types.js";

// 兼容旧导出:窄口 hook/provider 原样再转出,消费方 import 路径不变。
export {
  HomeTabsContext,
  HomeTabsProvider,
  useHomeTabs,
  useHomeDialogStore,
  useHomeWorkflowDialog,
  useHomeSettingsHub,
  useHomeBridge,
  useHomeStatusCard,
  useHomeStatusDetail,
  useHomeJobRuntime,
  useHomeBookDetail,
  useHomeCollections,
  useHomeArtifactDownloads,
  useHomeTextStore,
  useHomeHomeStateStore,
  useHomeCredentialsViewStore,
  useHomeUploadDomRefs,
  useHomeCredentialsStatePort,
  useHomeUploadStatePort,
} from "@/ui/context/home-services-context.js";
export type { HomeTabsValue, HomeNarrowServices } from "@/ui/context/home-services-context.js";


/** composition 的 HomeServices → 平台侧窄口聚合(同一实例按域切片,不新建对象)。 */
function toNarrowServices(services: HomeServices): HomeNarrowServices {
  return {
    dialogStore: services.stores.dialog,
    workflowDialog: services.workflowDialog,
    settingsHub: services.settingsHub,
    bridge: services.bridge,
    statusCard: services.statusCard,
    statusDetail: services.statusDetail,
    jobRuntime: services.jobRuntime,
    bookDetail: services.bookDetail,
    collections: services.collections,
    artifactDownloads: services.artifactDownloads,
    textStore: services.stores.text,
    homeStateStore: services.stores.homeState,
    credentialsViewStore: services.stores.credentialsView,
    uploadDomRefs: services.uploadDomRefs,
    credentialsStatePort: services.ports.credentialsStatePort,
    uploadStatePort: services.ports.uploadStatePort,
    reader: services.reader,
  };
}

// ── 只有主页自己（HomeApp 的插槽）用的窄口，住在 app 层 ──
//
// 版本检查、术语表、凭据这三样只被 HomeApp 读。它们以前也挂在 ui/context 上，
// 而 ui 层不许 import 功能类型，于是值类型只能写 any。app 层本来就能用功能的真实
// 类型（HomeServices 里就有），所以挪到这里：仍是一样一个窄口，不回到泛型大包。

function createAppNarrowHook<T>(context: Context<T | null>, name: string) {
  return function useAppNarrow(): T {
    const value = useContext(context);
    if (value == null) throw new Error(`${name} 需要外层 HomeShellProviders`);
    return value;
  };
}

const HomeAppUpdateContext = createContext<HomeServices["appUpdate"] | null>(null);
const HomeGlossariesContext = createContext<HomeServices["glossaries"] | null>(null);
const HomeCredentialsContext = createContext<HomeServices["credentials"] | null>(null);

export const useHomeAppUpdate = createAppNarrowHook(HomeAppUpdateContext, "useHomeAppUpdate");
export const useHomeGlossaries = createAppNarrowHook(HomeGlossariesContext, "useHomeGlossaries");
export const useHomeCredentials = createAppNarrowHook(HomeCredentialsContext, "useHomeCredentials");

/** Shell 窄口注入:把 composition 的 HomeServices 按域映射,灌入全部窄 Context。 */
export function HomeShellProviders({ services, children }: { services: HomeServices; children: ReactNode }) {
  // 泛型大包（HomeServicesContext）已退役：这里不再套外层 Provider，
  // 只把 composition 的 HomeServices 按域映射成窄口聚合往下灌。
  const appOnly = createElement(
    HomeAppUpdateContext.Provider,
    { value: services.appUpdate },
    createElement(
      HomeGlossariesContext.Provider,
      { value: services.glossaries },
      createElement(HomeCredentialsContext.Provider, { value: services.credentials }, children),
    ),
  );
  return createElement(NarrowHomeShellProviders, { services: toNarrowServices(services), children: appOnly });
}
