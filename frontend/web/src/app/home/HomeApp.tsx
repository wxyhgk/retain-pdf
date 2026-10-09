// home 页 React 编排根。
//
// 结构对照 旧世界 HTML 骨架(已删除,见 git 历史) 逐区块镜像;顶部只留
// 品牌 + 图书馆/分类分栏(AppTopBar.jsx,去掉白卡背景);添加/搜索/设置 三样
// 收进底部一条居中浮动栏(AppBottomBar.jsx,取代早期分离的 AppBottomActions +
// LibrarySearchDock 两个浮岛)。
// 其余区块(library-view 网格、credentials/glossaries/status-detail 等)
// 已陆续接上;ReaderNavigation 仅导航到 reader.html(无 UI)。
// 自定义元素只剩 <library-search-island> 一个真实注册点(见下方 islands 说明);
// 其余占位标签在新世界不注册定义,已随 cutover 从 JSX 移除。
//
// Shell 收口:HomeApp 只做 providers 嵌套(HomeShellProviders + HomeTabsProvider),
// HomeShell 承载 tabs 本地态 + AppTopBar/BottomBar + home-paper-stage。
// tabs 切页只改本地 state + URL ?tab=(replaceState,不导航、不碰 store)。

import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  HomeShellProviders,
  HomeTabsProvider,
  useHomeTabs,
  useHomeAppUpdate,
  useHomeBookDetail,
  useHomeCollections,
  useHomeCredentials,
  useHomeCredentialsStatePort,
  useHomeGlossaries,
  useHomeLibrary,
  useHomeSettingsHub,
  useHomeWorkflowDialog,
} from "./home-services-context.js";
import type { HomeServices } from "./composition/types.js";
import { AppTopBar } from "./shell/AppTopBar.jsx";
import { AppBottomBar, HOME_TASK_CENTER_OPEN_EVENT } from "./shell/AppBottomBar.jsx";
import { MockModeBanner } from "./shell/MockModeBanner.jsx";
import { IngestDialog, IngestWorkflowViewProvider } from "@/features/ingest/index.js";
import {
  RecentJobsLibrary,
} from "@/features/library/index.js";
import { AppUpdateBanner } from "@/features/app-update/index.js";
import { GlossariesDialog } from "@/features/glossaries/index.js";
import {
  CredentialsProvider,
  CredentialsWorkbench,
  HiddenCredentialInputs,
} from "@/features/credentials/index.js";
import { useDialogState } from "@/ui/hooks/use-dialog-state.js";
import { SettingsDialog } from "@/features/settings/index.js";
import { useAppEvent } from "@/ui/hooks/use-app-event.js";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";
import { CREDENTIAL_DOM_IDS } from "@/features/credentials/ui/credentials-dom-ids.js";
import { StatusDetailDialog } from "@/features/job-detail/index.js";
import { ReaderNavigation, SoftReaderHost } from "@/features/reader/index.js";
import {
  CollectionDialog,
  CollectionsView,
} from "@/features/collections/index.js";
import { DownloadToastHost } from "@/ui/download-toast/DownloadToastHost.jsx";
import { parseHomeTab } from "@/platform/navigation/pages.js";
import {
  readInitialLibraryTabFromReturn,
  useHomeReturnRestore,
} from "@/features/library/index.js";
// library-search-island 自定义元素的唯一注册点。旧世界由 src/js/components/index.js
// 兜底 side-effect import 注册;该文件随 cutover 删除后,注册链路断了会导致下方
// JSX 里的 <library-search-island> 标签渲染成惰性空标签(数据契约上仍在,但搜索
// 功能静默失效——只有真实浏览器渲染能看出来,jsdom 不会报错)。这里经 composition/external
// 显式接管注册，避免 pages 层直连 src/js（门禁：home features/pages → external）。
import "@/features/library/ui/island/index.js";

// ---- 按需加载 ----
//
// 这几块只在用户点过去时才出现，代码不该跟着首屏一起下载：
// - AI 问答：自带一整套 Markdown 流式渲染（markstream-react + stream-markdown-parser，
//   约 600KB），以前占主页首屏的三分之一，不点 AI 问答一行都用不到；
// - 任务中心：底部栏点开才显示；
// - 书籍详情：点开一本书才显示（见 BookDetailDialogSlot）。
// 三者都只被本文件引用，走各自 index 的动态 import，不破坏「index 是唯一出口」。
const HomeAskView = lazy(() => import("@/features/ask/index.js").then((m) => ({ default: m.HomeAskView })));
const TaskCenter = lazy(() => import("@/features/task-center/index.js").then((m) => ({ default: m.TaskCenter })));
const BookDetailDialog = lazy(() => import("@/features/book-detail/index.js").then((m) => ({ default: m.BookDetailDialog })));

const HOME_TABS = ["library", "categories", "ask"] as const;
type HomeTab = (typeof HOME_TABS)[number];

function isHomeTab(tab: string): tab is HomeTab {
  return (HOME_TABS as readonly string[]).includes(tab);
}

// 初始 tab:显式 ?tab= 深链优先(可分享/刷新保持),否则沿用阅读器返回恢复,
// 兜底图书馆。非法值一律回图书馆,不抛错。
function readInitialHomeTab(): string {
  try {
    const fromUrl = parseHomeTab();
    if (isHomeTab(fromUrl)) return fromUrl;
  } catch {
    // 非浏览器/jsdom 无 location 时忽略,走返回恢复
  }
  const fromReturn = readInitialLibraryTabFromReturn();
  return isHomeTab(fromReturn) ? fromReturn : "library";
}

// tabs 切页的唯一写出口:只动 URL search,不导航、不碰 store。
function writeHomeTabToSearch(tab: string) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
  } catch {
    // jsdom/旧环境缺 history 时静默忽略——本地 state 照常切换
  }
}

// tabs 本地态拥有者:state + ?tab= 同步,经 HomeTabsProvider 下发给 Shell。
function HomeTabsRoot({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState(readInitialHomeTab);
  const onTabChange = useCallback((tab: string) => {
    if (!isHomeTab(tab)) return;
    setActiveTab(tab);
    writeHomeTabToSearch(tab);
  }, []);
  return <HomeTabsProvider value={{ activeTab, onTabChange }}>{children}</HomeTabsProvider>;
}

// ---- 功能插槽（页面侧绑定）----
//
// src/features/* 不依赖任何具体页面，尤其不 import home-services-context；
// 由页面在这里把自己的服务上下文接到功能的 props 上。功能因此可以被
// detail/reader 或测试独立复用。每迁入一个功能就在这里加一个对应的 Slot。

function AppUpdateBannerSlot() {
  const appUpdate = useHomeAppUpdate();
  return <AppUpdateBanner view={appUpdate.view} handlersRef={appUpdate.handlersRef} />;
}

function CollectionsViewSlot() {
  const collections = useHomeCollections();
  const library = useHomeLibrary();
  return (
    <CollectionsView
      controller={collections.controller}
      dialogStore={collections.dialogStore}
      reloadSignal={collections.reloadSignal}
      libraryActions={library.actions}
    />
  );
}

function CollectionDialogSlot() {
  const collections = useHomeCollections();
  return (
    <CollectionDialog
      controller={collections.controller}
      dialogStore={collections.dialogStore}
      reloadSignal={collections.reloadSignal}
    />
  );
}

// 任务中心浮层插槽：点任务卡片走同一套书籍详情（job_id 兜底开详情壳，
// 见 library/domain/documents/navigation-actions），与网格行为一致。
function TaskCenterSlot() {
  const library = useHomeLibrary();
  return (
    <TaskCenter
      onOpenBookDetail={(input) => {
        (library.actions.openBookDetail as (item: any) => void)(input);
      }}
    />
  );
}
// 书籍详情第一次打开时才下载并挂载；之后一直挂着，关闭动画、再次打开都和以前一样。
function BookDetailDialogSlot() {
  const { dialogStore } = useHomeBookDetail();
  const dialogState: any = useDialogState(dialogStore);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (dialogState.open) setMounted(true);
  }, [dialogState.open]);
  if (!mounted && !dialogState.open) return null;
  return (
    <Suspense fallback={null}>
      <BookDetailDialog />
    </Suspense>
  );
}

function SettingsDialogSlot() {
  const settingsHub = useHomeSettingsHub();
  const glossaries = useHomeGlossaries();
  const credentials = useHomeCredentials();

  // 「打开接口设置」只有这一个落点了。首次配置门曾经另开一个独立弹窗
  // （CredentialsDialog），于是同一件事有两个长得不一样的壳；现在两条路都是
  // 本弹窗停在 api tab，区别只在 payload.setupMode。
  useAppEvent(APP_EVENTS.openBrowserCredentials, (event) => {
    const detail = event?.detail || {};
    settingsHub?.dialogStore?.open?.({ tab: "api", setupMode: Boolean(detail.setupMode) });
  });

  return (
    <SettingsDialog
      dialogStore={settingsHub.dialogStore}
      onOpenGlossaries={() => glossaries.dialogStore.open()}
      onPrepareCredentialPanels={(options) => credentials?.feature?.prepareCredentialsPanels?.(options)}
      credentialsWorkbenchSlot={<CredentialsWorkbench />}
      apiPaneSetupHintSlot={
        <p id={CREDENTIAL_DOM_IDS.browser.subtitle} className="muted">先配好接口再开始</p>
      }
      appUpdateBannerSlot={<AppUpdateBannerSlot />}
    />
  );
}

function GlossariesDialogSlot() {
  const glossaries = useHomeGlossaries();
  const dialogState = useDialogState(glossaries.dialogStore);
  return (
    <GlossariesDialog
      feature={glossaries.feature}
      view={glossaries.view}
      dialogStore={glossaries.dialogStore}
      open={Boolean(dialogState.open)}
    />
  );
}

function HomeShell() {
  // tabs 来自窄口,不再由 Shell 自持 useState(状态上移到 HomeTabsRoot)。
  const { activeTab } = useHomeTabs();
  const isLibraryTab = activeTab === "library";
  // 历史契约 key "categories" == 领域 collections（见 LibraryTopTabs/COLLECTIONS_TAB_KEY 映射）
  const isCategoriesTab = activeTab === "categories";
  const isCollectionsTab = isCategoriesTab; // 统一别名，领域语义用 collections
  const isAskTab = activeTab === "ask";
  // #31 批量选择工具栏和底部栏都固定在底部居中,批量模式期间底部栏用 CSS
  // 隐藏(不卸载——搜索 input 卸载会让 library-search-island 的引用失效)让位
  // 给批量工具栏,两者不同时可见。
  const [batchModeActive, setBatchModeActive] = useState(false);
  // 任务中心浮层：不占 ?tab=（平台白名单无 tasks 键），只盖住纸心舞台，
  // 由 AppBottomBar 的 #home-task-center-btn 经事件打开。
  const [tasksOpen, setTasksOpen] = useState(false);
  useEffect(() => {
    const open = () => setTasksOpen(true);
    document.addEventListener(HOME_TASK_CENTER_OPEN_EVENT, open);
    return () => document.removeEventListener(HOME_TASK_CENTER_OPEN_EVENT, open);
  }, []);

  // 合集/AI tab：视图挂载即可尝试恢复 panel 滚动（图书馆由 RecentJobsLibrary 在有列表后恢复）
  useHomeReturnRestore(isCategoriesTab || isAskTab);

  // 这里曾挂一张页面级状态卡 #job-status-card。已下线：进度主场是书籍详情的
  // 「进度」Tab（#book-detail-job-status-card），图书馆卡片与任务中心也各自
  // 显示进度——主页这张只是重复的遗留界面，实测还会留在详情弹窗背后讲同一份
  // 进度、并被视口左缘截掉一半。statusArea 状态机本身保留（工作流弹窗靠
  // statusAreaPort.isVisible() 算 upload/status 模式）。

  return (
    <>
      <main id="app-shell" className="page app-shell" data-home-spa="">
        <AppTopBar />
        <MockModeBanner />
        {/* 纸心舞台：材质/比例层级（非传统符号拼贴）；侧栏筛选暂不做 */}
        <div className="home-paper-stage">
          {tasksOpen ? (
            <>
              <div className="tasks-view-toolbar">
                <button
                  id="task-center-back-btn"
                  type="button"
                  className="secondary"
                  aria-label="返回"
                  onClick={() => setTasksOpen(false)}
                >
                  ← 返回
                </button>
              </div>
              <Suspense fallback={null}>
                <TaskCenterSlot />
              </Suspense>
              <AppBottomBar showSearch={false} />
            </>
          ) : isLibraryTab ? (
            <>
              <RecentJobsLibrary {...({ onBatchModeChange: setBatchModeActive } as any)} />
              <AppBottomBar showSearch hidden={batchModeActive} />
              <library-search-island></library-search-island>
            </>
          ) : isCollectionsTab ? (
            <>
              <CollectionsViewSlot />
              <AppBottomBar showSearch={false} />
            </>
          ) : isAskTab ? (
            // AI 对话不挂底部「上传 / 设置」浮栏，避免压住输入区
            <Suspense fallback={null}>
              <HomeAskView />
            </Suspense>
          ) : null}
        </div>
        <button id="open-query-btn" type="button" className="secondary hidden" aria-hidden="true">最近任务</button>
        <SettingsDialogSlot />
        <IngestDialog hiddenInputsSlot={<HiddenCredentialInputs />} />
      </main>
      {/* dialogs.html 区块:credentials 域已 React 化,其余占位(3b) */}
      <GlossariesDialogSlot />
      <developer-auth-dialog></developer-auth-dialog>
      <developer-settings-dialog></developer-settings-dialog>
      <StatusDetailDialog />
      <ReaderNavigation />
      {/* 软打开阅读器：全屏层，主页不卸载（关 × 不刷新） */}
      <SoftReaderHost />
      <CollectionDialogSlot />
      <BookDetailDialogSlot />
      {/* sonner 全局宿主：DownloadToastHost 内含 <Toaster/>，任务中心取消/重试、
          收藏等处的 toast.success/error 都经它渲染——TaskCenter 不自带 Toaster，
          挂载在 HomeApp 下即接入现有宿主，不另起第二个（sonner 双宿主会重影）。 */}
      <DownloadToastHost />
    </>
  );
}

/**
 * 页面侧绑定：把主页的服务上下文喂给 credentials 功能自带的 context。
 *
 * credentials 的组件树有四层（Workbench / Dialog / ProviderPanels /
 * HiddenInputs），逐层传 prop 过于侵入，故功能自持 context，页面只提供值。
 */
function CredentialsProviderSlot({ children }: { children: React.ReactNode }) {
  const credentials = useHomeCredentials();
  const credentialsStatePort = useHomeCredentialsStatePort();
  const settingsHub = useHomeSettingsHub();
  return (
    <CredentialsProvider
      value={{
        feature: credentials?.feature,
        view: credentials?.view,
        credentialsStatePort,
      }}
    >
      {children}
    </CredentialsProvider>
  );
}

export function HomeApp({ services }: { services: HomeServices }) {
  return (
    <HomeShellProviders services={services}>
      {/* 「添加 PDF」的用户选项走 ingest 自带的 context，同 CredentialsProviderSlot。 */}
      <IngestWorkflowViewProvider value={services.workflowView}>
        <HomeTabsRoot>
          <CredentialsProviderSlot>
            <HomeShell />
          </CredentialsProviderSlot>
        </HomeTabsRoot>
      </IngestWorkflowViewProvider>
    </HomeShellProviders>
  );
}
