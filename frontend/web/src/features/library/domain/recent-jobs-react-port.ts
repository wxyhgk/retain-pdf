// recent-jobs 引擎的 viewPort → React 实现(蓝图 §2 features/library/)。
//
// 列表内容由 React 组件直接订阅 recentJobsStatePort.store；引擎经这里只发几个
// 「瞬态信号」写进 libraryViewStore：加载中、加载更多中、空、出错、hasMore
// （「加载更多」按钮可见性），以及分页后的自动补拉检查。
//
// 旧契约里还有 hasView / replaceCard / setDialogOpen 三个方法，以及引擎里配套的
// storeDrivenRendering 开关与「最近任务弹窗」打开 / 关闭链路：React 里它们要么恒真、
// 要么什么都不做（DOM 卡片替换、旧弹窗都不存在了），已连同引擎侧的死分支一起删除。

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
    current: { onLoadMore: null, onSearch: null, isSuspended: () => false },
  };
  const autoLoadCheckerRef: {
    current: null | ((options?: AutoLoadCheckOptions) => void);
  } = { current: null };

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

  function setLoadMoreLoading() {
    viewStore.actions.setLoadMoreLoading();
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
    onLoadMore,
    onSearch,
    isSuspended = () => false,
  }: Partial<RecentJobsViewPortHandlers> = {}) {
    handlersRef.current = { onLoadMore, onSearch, isSuspended };
  }

  return {
    store: viewStore,
    handlersRef,
    bindEvents,
    registerAutoLoadChecker,
    renderEmpty,
    renderError,
    renderList,
    renderLoading,
    scheduleAutoLoadCheck,
    setLoadMoreLoading,
  };
}
