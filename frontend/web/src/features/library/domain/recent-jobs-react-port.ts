// recent-jobs 引擎的 viewPort 契约 → React 实现(蓝图 §2 features/library/)。
//
// 铁律:轮询/补丁/节流引擎(controller/runtime/loader/commit/bindings…)一行不
// 改;这里只满足 view-port.js 定义的 10 个方法契约,把副作用从"操作 DOM"换成
// "写 libraryViewStore"。renderList 故意忽略 items 参数——React 组件直接订阅
// recentJobsStatePort.store 读取列表内容,这里只搬运 hasMore 用于 load-more
// 按钮可见性。
//
// hasView() 恒 true:loader.js 用它做"host 不存在就跳过加载"的短路判断,React
// 世界的图书馆视图永远挂载。replaceCard() 恒 true:引擎在 storeDrivenRendering
// 下不会真正依赖其返回值做条件渲染分支,React 卡片改由 memo 签名比较驱动重渲
// (见 RecentJobCard.jsx),这里返回 true 只是满足调用方"未失败"的语义。

import { createLibraryViewStore } from "./library-view-store.js";
import type {
  AutoLoadCheckOptions,
  LibraryViewStore,
  RecentJobsReactViewPort,
  RecentJobsReactViewPortOptions,
  RecentJobsViewPortHandlers,
} from "./types.js";

export function createRecentJobsReactViewPort({
  store = createLibraryViewStore(),
}: RecentJobsReactViewPortOptions = {}): RecentJobsReactViewPort {
  const viewStore: LibraryViewStore = store;
  const handlersRef: { current: RecentJobsViewPortHandlers } = {
    current: { onOpen: null, onLoadMore: null, onSearch: null, isSuspended: () => false },
  };
  const autoLoadCheckerRef: {
    current: null | ((options?: AutoLoadCheckOptions) => void);
  } = { current: null };

  function hasView() {
    return true;
  }

  function renderLoading() {
    viewStore.actions.setLoading();
  }

  function renderEmpty(message?: string) {
    viewStore.actions.setEmpty(message);
  }

  function renderError(message?: string, { reset = false }: { reset?: boolean } = {}) {
    if (reset) {
      viewStore.actions.setErrorReset(message);
      return;
    }
    // 镜像旧 applyRecentJobsErrorState 的 reset:false 分支:只清 load-more
    // 的加载态,不展示错误文案(错误提示走 error-box 通道,不在此越权渲染)。
    viewStore.actions.clearLoadMoreLoading();
  }

  function renderList({ hasMore = false }: { hasMore?: boolean } = {}) {
    viewStore.actions.setList(hasMore);
  }

  function replaceCard() {
    return true;
  }

  function setLoadMoreLoading() {
    viewStore.actions.setLoadMoreLoading();
  }

  function setDialogOpen() {
    // recent-jobs-dialog 元素形态在主视图不启用(蓝图 §2),契约方法保留为
    // no-op,避免引擎里任何遗留调用路径抛错。
  }

  function scheduleAutoLoadCheck(options?: AutoLoadCheckOptions) {
    autoLoadCheckerRef.current?.(options);
  }

  // 非契约方法:useLibraryAutoLoad 用它把自己的几何检查函数接进
  // scheduleAutoLoadCheck 的调用链(refresh-scheduler.js 在每次分页提交后调用)。
  function registerAutoLoadChecker(
    checker: ((options?: AutoLoadCheckOptions) => void) | null | undefined,
  ) {
    autoLoadCheckerRef.current = typeof checker === "function" ? checker : null;
    return () => {
      if (autoLoadCheckerRef.current === checker) {
        autoLoadCheckerRef.current = null;
      }
    };
  }

  function bindEvents({
    onOpen,
    onLoadMore,
    onSearch,
    isSuspended = () => false,
  }: Partial<RecentJobsViewPortHandlers> = {}) {
    handlersRef.current = { onOpen, onLoadMore, onSearch, isSuspended };
  }

  return {
    store: viewStore,
    handlersRef,
    bindEvents,
    hasView,
    registerAutoLoadChecker,
    renderEmpty,
    renderError,
    renderList,
    renderLoading,
    replaceCard,
    scheduleAutoLoadCheck,
    setDialogOpen,
    setLoadMoreLoading,
  };
}
