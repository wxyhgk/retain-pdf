// 主页窄口 Context（UI/平台侧）——把 app/home/home-services-context.ts 里那四个
// 「按域拆窄」的先例正式下沉到与 features 同侧（features → ui → platform），
// 让功能可以只依赖窄口而不再 import app 的上帝包，从结构上断开
// features ⇄ app/home/composition/types 的 40 文件环。
//
// 硬约束（layer-boundaries 门禁强制）：
// - 本模块只 import react 与 @/platform/*。**不得** import @/app/* 或
//   @/features/*——一旦引入就又成环（ui 只允许 ui/platform）。
// - 所有窄口类型在本模块内结构化定义，不引用 composition/types 或任何功能类型。
// - app 侧（src/app/home/home-services-context.ts）负责用 composition 的
//   HomeServices 实例映射出这些窄口值并经 HomeShellProviders 注入。
//
// 窄口是唯一来源：曾经的「泛型大包 + pick 回退」兼容口已退役（见下方
// createNarrowHook 的说明），缺 Provider 直接按名字抛错。

import { createContext, createElement, useContext } from "react";
import type { Context, ReactNode } from "react";
import type { DialogStore } from "@/platform/store/dialog-store.js";

/** 窄口只暴露 store 读侧；写入仍经 store.actions / 域 action。
 *  subscribe 只建模单参监听（各域 store 的 notify 均为单参），兼容通用 Store
 *  的双参监听与域内定制的单参订阅。 */
export type HomeReadStore<T = any> = {
  getSnapshot: () => T;
  subscribe: (listener: (snapshot: T) => void) => () => void;
};

// ── 窄口值类型（全部本地结构化定义，不引用功能/composition 类型） ──

export type HomeDialogStoreValue = HomeReadStore;

// 组件只用得到这两个「请求」口；openUpload/close/isOpen/bindEvents/sync/statePort
// 是 runtime 自己的内部面，由 composition 直接持有，不经 React。
export type HomeWorkflowDialogValue = {
  requestOpenUpload: () => void;
  requestClose: () => void;
};

export type HomeSettingsHubValue = {
  /** payload.setupMode：首次配置门也开这个弹窗，只是停在 api tab 并换成引导形态。 */
  dialogStore: DialogStore<{ tab?: string; setupMode?: boolean } | null>;
};

export type HomeBridgeValue = {
  submitForm: (event?: { preventDefault?: () => void } | null) => unknown;
};

export type HomeLibraryValue = {
  actions: any;
  viewPort: any;
  recentJobsStore: HomeReadStore;
};

export type HomeStatusCardValue = {
  store: HomeReadStore;
  cancelCurrentJob: (...args: any[]) => unknown;
};

export type HomeStatusDetailValue = {
  store: HomeReadStore;
  dialogStore: DialogStore<any>;
  controller: any;
};

export type HomeJobRuntimeValue = {
  store: HomeReadStore;
};

export type HomeBookDetailValue = {
  dialogStore: DialogStore<any>;
};

export type HomeCollectionsValue = {
  controller: any;
  reloadSignal: any;
  dialogStore: DialogStore<any>;
};

/** services.appUpdate —— 版本检查横幅的视图与处理函数表。 */
export type HomeAppUpdateValue = {
  feature?: any;
  view: any;
  handlersRef: any;
};

/** services.glossaries —— 术语表弹窗的 feature/视图/开合。 */
export type HomeGlossariesValue = {
  feature?: any;
  view: any;
  dialogStore: DialogStore<any>;
};

/** services.credentials —— 凭据工作台的 feature/视图/开合。 */
export type HomeCredentialsValue = {
  feature?: any;
  view?: any;
  dialogStore?: DialogStore<any>;
};

export type HomeArtifactDownloadsValue = {
  // any 而不是 HomeReadStore：消费方（ResultActions / OverviewPanel）要的是
  // artifacts 域的 busy store 全貌（getActionState/setBusy/clearBusy…），而 ui
  // 层不能 import features 的类型。删掉 createNarrowHook 的 pick 回退后类型
  // 收紧，这处债才显形——此前 pick 的 any 让所有窄 hook 都返回 any。
  busyStore: any;
};

/** uploadView 读侧之外 TranslationOptionsPanel 还经 .actions 写页码范围。 */
export type HomeUploadViewStoreValue = HomeReadStore & { actions?: any };

export type HomeWorkflowViewActionsValue = {
  setSelectedGlossaryId: (id: string) => unknown;
  setTranslationQuality: (value: string) => unknown;
  setOcrOnly: (value: boolean) => unknown;
  isOcrOnly: () => boolean;
};

export type HomeUploadDomRefsValue = {
  fileInput: HTMLInputElement | null;
};

// 只登记窄口消费方真正读到的两个。其余七个 feature 仍然活在 composition 的
// HomeFeatures 上（entry/测试经 services.features 直取），只是没有任何组件
// 经这个 hook 读它们——写在这里只是让 useHomeFeatures() 的返回值显得什么都有。
export type HomeFeaturesValue = {
  workflowFeature?: any;
  uploadFeature?: any;
};

export type HomeCredentialsStatePortValue = {
  store: HomeReadStore;
};

export type HomeUploadStatePortValue = {
  // 同上：联合里的 unknown 会把整个返回值拖成 unknown，消费方读 documentId 即报错。
  getSnapshot?: () => { documentId?: string } | undefined;
};

/** 主页阅读入口（跳独立 reader.html）。 */
export type HomeReaderValue = {
  openReader: (jobId: string, anchor?: unknown, documentId?: string, options?: { pinJob?: boolean }) => unknown;
};

/** app 侧映射出的窄口聚合；HomeShellProviders 按此一次灌入全部窄 Context。 */
export type HomeNarrowServices = {
  dialogStore: HomeDialogStoreValue;
  workflowDialog: HomeWorkflowDialogValue;
  settingsHub: HomeSettingsHubValue;
  bridge: HomeBridgeValue;
  library: HomeLibraryValue;
  statusCard: HomeStatusCardValue;
  statusDetail: HomeStatusDetailValue;
  jobRuntime: HomeJobRuntimeValue;
  bookDetail: HomeBookDetailValue;
  collections: HomeCollectionsValue;
  appUpdate: HomeAppUpdateValue;
  glossaries: HomeGlossariesValue;
  credentials: HomeCredentialsValue;
  artifactDownloads: HomeArtifactDownloadsValue;
  textStore: HomeReadStore;
  homeStateStore: HomeReadStore;
  workflowViewStore: HomeReadStore;
  uploadViewStore: HomeUploadViewStoreValue;
  credentialsViewStore: HomeReadStore;
  features: HomeFeaturesValue;
  workflowViewActions: HomeWorkflowViewActionsValue;
  uploadDomRefs: HomeUploadDomRefsValue;
  credentialsStatePort: HomeCredentialsStatePortValue;
  uploadStatePort: HomeUploadStatePortValue;
  reader: HomeReaderValue;
};

// ── 泛型 bag + 窄 Context ──


export const HomeDialogStoreContext = createContext<HomeDialogStoreValue | null>(null);
export const HomeWorkflowDialogContext = createContext<HomeWorkflowDialogValue | null>(null);
export const HomeSettingsHubContext = createContext<HomeSettingsHubValue | null>(null);
export const HomeBridgeContext = createContext<HomeBridgeValue | null>(null);
export const HomeLibraryContext = createContext<HomeLibraryValue | null>(null);
export const HomeStatusCardContext = createContext<HomeStatusCardValue | null>(null);
export const HomeStatusDetailContext = createContext<HomeStatusDetailValue | null>(null);
export const HomeJobRuntimeContext = createContext<HomeJobRuntimeValue | null>(null);
export const HomeBookDetailContext = createContext<HomeBookDetailValue | null>(null);
export const HomeCollectionsContext = createContext<HomeCollectionsValue | null>(null);
export const HomeAppUpdateContext = createContext<HomeAppUpdateValue | null>(null);
export const HomeGlossariesContext = createContext<HomeGlossariesValue | null>(null);
export const HomeCredentialsContext = createContext<HomeCredentialsValue | null>(null);
export const HomeArtifactDownloadsContext = createContext<HomeArtifactDownloadsValue | null>(null);
export const HomeTextStoreContext = createContext<HomeReadStore | null>(null);
export const HomeHomeStateStoreContext = createContext<HomeReadStore | null>(null);
export const HomeWorkflowViewStoreContext = createContext<HomeReadStore | null>(null);
export const HomeUploadViewStoreContext = createContext<HomeUploadViewStoreValue | null>(null);
export const HomeCredentialsViewStoreContext = createContext<HomeReadStore | null>(null);
export const HomeFeaturesContext = createContext<HomeFeaturesValue | null>(null);
export const HomeWorkflowViewActionsContext = createContext<HomeWorkflowViewActionsValue | null>(null);
export const HomeUploadDomRefsContext = createContext<HomeUploadDomRefsValue | null>(null);
export const HomeCredentialsStatePortContext = createContext<HomeCredentialsStatePortValue | null>(null);
export const HomeUploadStatePortContext = createContext<HomeUploadStatePortValue | null>(null);
export const HomeReaderContext = createContext<HomeReaderValue | null>(null);

// ── 窄 hook 工厂：窄 Context 缺失时回退到 app 灌入的 HomeServices 大包 ──

// 窄口是唯一来源。
//
// 这里曾经有第二条路：窄 Context 缺席时回退到泛型大包（HomeServicesContext，
// 值类型 unknown），用一个 pick(bag) 现取。那是上一轮迁移期留的兼容口——新建
// 窄口时老代码和老测试还只挂着大包 Provider，有它就不用一次性改完。
//
// 兼容口只要还在，大包就删不掉：你无法知道还有谁在靠它活着，而且组件的真实
// 依赖不会出现在任何签名里。现在生产侧对大包的引用已归零，唯一靠回退活着的
// 测试（retranslate-flow）也改挂了窄口 Provider，所以这条路收掉。
//
// 缺 Provider 直接抛错，比静默 pick 一个 undefined 出来好——后者的症状是
// 下游某处读属性炸掉，栈指向的是受害者而不是原因。
function createNarrowHook<T>(context: Context<T | null>, name: string): () => T {
  return function useNarrow(): T {
    const narrow = useContext(context);
    if (!narrow) {
      throw new Error(`${name} 必须在 <HomeShellProviders> 内使用`);
    }
    return narrow;
  };
}

export const useHomeDialogStore = createNarrowHook(
  HomeDialogStoreContext,
  "useHomeDialogStore",
);
export const useHomeWorkflowDialog = createNarrowHook(
  HomeWorkflowDialogContext,
  "useHomeWorkflowDialog",
);
export const useHomeSettingsHub = createNarrowHook(
  HomeSettingsHubContext,
  "useHomeSettingsHub",
);
export const useHomeBridge = createNarrowHook(
  HomeBridgeContext,
  "useHomeBridge",
);
export const useHomeLibrary = createNarrowHook(
  HomeLibraryContext,
  "useHomeLibrary",
);
export const useHomeStatusCard = createNarrowHook(
  HomeStatusCardContext,
  "useHomeStatusCard",
);
export const useHomeStatusDetail = createNarrowHook(
  HomeStatusDetailContext,
  "useHomeStatusDetail",
);
export const useHomeJobRuntime = createNarrowHook(
  HomeJobRuntimeContext,
  "useHomeJobRuntime",
);
export const useHomeBookDetail = createNarrowHook(
  HomeBookDetailContext,
  "useHomeBookDetail",
);
export const useHomeCollections = createNarrowHook(
  HomeCollectionsContext,
  "useHomeCollections",
);
export const useHomeAppUpdate = createNarrowHook(
  HomeAppUpdateContext,
  "useHomeAppUpdate",
);
export const useHomeGlossaries = createNarrowHook(
  HomeGlossariesContext,
  "useHomeGlossaries",
);
export const useHomeCredentials = createNarrowHook(
  HomeCredentialsContext,
  "useHomeCredentials",
);
export const useHomeArtifactDownloads = createNarrowHook(
  HomeArtifactDownloadsContext,
  "useHomeArtifactDownloads",
);
export const useHomeTextStore = createNarrowHook(
  HomeTextStoreContext,
  "useHomeTextStore",
);
export const useHomeHomeStateStore = createNarrowHook(
  HomeHomeStateStoreContext,
  "useHomeHomeStateStore",
);
export const useHomeWorkflowViewStore = createNarrowHook(
  HomeWorkflowViewStoreContext,
  "useHomeWorkflowViewStore",
);
export const useHomeUploadViewStore = createNarrowHook(
  HomeUploadViewStoreContext,
  "useHomeUploadViewStore",
);
export const useHomeCredentialsViewStore = createNarrowHook(
  HomeCredentialsViewStoreContext,
  "useHomeCredentialsViewStore",
);
export const useHomeFeatures = createNarrowHook(
  HomeFeaturesContext,
  "useHomeFeatures",
);
export const useHomeWorkflowViewActions = createNarrowHook(
  HomeWorkflowViewActionsContext,
  "useHomeWorkflowViewActions",
);
export const useHomeUploadDomRefs = createNarrowHook(
  HomeUploadDomRefsContext,
  "useHomeUploadDomRefs",
);
export const useHomeCredentialsStatePort = createNarrowHook(
  HomeCredentialsStatePortContext,
  "useHomeCredentialsStatePort",
);
export const useHomeUploadStatePort = createNarrowHook(
  HomeUploadStatePortContext,
  "useHomeUploadStatePort",
);
export const useHomeReader = createNarrowHook(
  HomeReaderContext,
  "useHomeReader",
);

// ── 一次灌入所有窄 Context（app 侧映射 HomeServices → HomeNarrowServices） ──

export function HomeShellProviders({ services, children }: { services: HomeNarrowServices; children: ReactNode }) {
  const providers: Array<[Context<any>, any]> = [
    [HomeDialogStoreContext, services.dialogStore],
    [HomeWorkflowDialogContext, services.workflowDialog],
    [HomeSettingsHubContext, services.settingsHub],
    [HomeBridgeContext, services.bridge],
    [HomeLibraryContext, services.library],
    [HomeStatusCardContext, services.statusCard],
    [HomeStatusDetailContext, services.statusDetail],
    [HomeJobRuntimeContext, services.jobRuntime],
    [HomeBookDetailContext, services.bookDetail],
    [HomeCollectionsContext, services.collections],
    [HomeAppUpdateContext, services.appUpdate],
    [HomeGlossariesContext, services.glossaries],
    [HomeCredentialsContext, services.credentials],
    [HomeArtifactDownloadsContext, services.artifactDownloads],
    [HomeTextStoreContext, services.textStore],
    [HomeHomeStateStoreContext, services.homeStateStore],
    [HomeWorkflowViewStoreContext, services.workflowViewStore],
    [HomeUploadViewStoreContext, services.uploadViewStore],
    [HomeCredentialsViewStoreContext, services.credentialsViewStore],
    [HomeFeaturesContext, services.features],
    [HomeWorkflowViewActionsContext, services.workflowViewActions],
    [HomeUploadDomRefsContext, services.uploadDomRefs],
    [HomeCredentialsStatePortContext, services.credentialsStatePort],
    [HomeUploadStatePortContext, services.uploadStatePort],
    [HomeReaderContext, services.reader],
  ];
  return providers.reduceRight<ReactNode>(
    (acc, [context, value]) => createElement(context.Provider, { value }, acc),
    children,
  );
}

// ── Tabs 本地态 Context（tabs 切页只改本地 state + URL ?tab=，不碰 store） ──

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
