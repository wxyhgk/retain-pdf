import { APP_EVENTS } from "@/platform/contracts/app-contract.js";
import { bindRecentJobsCommandHandlers, type BindRecentJobsCommandHandlersOptions } from "./command-handlers.js";
import type { RecentJobsCommandPort, RecentJobsJobCommandPayload } from "./commands.js";
import { invalidateLibraryBooksResource, type createLibraryBooksResource } from "./library-books-resource.js";
import type { createRecentJobsLibraryRefreshPort } from "./library-refresh-port.js";
import type { createRecentJobsRefreshScheduler } from "./refresh-scheduler.js";
import type { RecentJobsRuntime } from "./runtime.js";
import type { RecentJobsReactViewPort } from "../types.js";
import type { LibraryJobItem } from "./runtime-item.js";

export type BindRecentJobsFeatureEventsOptions = {
  apiPrefix?: string;
  commandPort: RecentJobsCommandPort;
  doc?: Document;
  fetchJobPayload?: BindRecentJobsCommandHandlersOptions["fetchJobPayload"];
  libraryBooksResource: ReturnType<typeof createLibraryBooksResource>;
  libraryRefreshPort: ReturnType<typeof createRecentJobsLibraryRefreshPort>;
  refreshScheduler: ReturnType<typeof createRecentJobsRefreshScheduler>;
  runtime: RecentJobsRuntime;
  viewPort: RecentJobsReactViewPort;
};

export function bindRecentJobsFeatureEvents({
  apiPrefix,
  commandPort,
  doc = document,
  fetchJobPayload,
  libraryBooksResource,
  libraryRefreshPort,
  refreshScheduler,
  runtime,
  viewPort,
}: BindRecentJobsFeatureEventsOptions) {
  viewPort.bindEvents({
    onLoadMore: () => runtime.loadRecentJobs({ reset: false }),
    onSearch: refreshScheduler.updateSearch,
    isSuspended: refreshScheduler.isSuspended,
  });

  const commandSubscription = bindRecentJobsCommandHandlers({
    apiPrefix,
    commandPort,
    fetchJobPayload,
    libraryBooksResource,
    runtimePatches: runtime.runtimePatches,
    refreshScheduler,
  });

  const librarySubscription = libraryRefreshPort.subscribe({
    onRefreshRequested: (detail) => {
      void commandPort.requestRefresh(detail);
    },
    // 库事件契约把 job 以 unknown 透传（platform 层未收紧），这里按命令端口约定的 LibraryJobItem 使用。
    onJobUpdated: ({ job }: { job?: unknown } = {}) => {
      void commandPort.publishJobUpdated(job as LibraryJobItem);
    },
    onJobCreated: ({ job }: { job?: unknown } = {}) => {
      void commandPort.publishJobCreated(job as LibraryJobItem);
    },
  });

  function onStatusAreaVisibilityChanged() {
    refreshScheduler.setSuspended(refreshScheduler.isSuspended());
  }
  function onOpenTranslationWorkflow() {
    refreshScheduler.setSuspended(true);
  }
  function onCloseTranslationWorkflow() {
    // 关闭上传/任务弹窗后必须真正刷新书架：上传只建文档、不建任务，若这里不刷新，
    // 新上传的 PDF 要等整页刷新才会出现。
    //
    // 注意：`bypassThrottle` **不解除 suspend**，而 `scheduleRefresh` 在
    // `isWorkflowOpen()`（DOM `data-open`）仍为真时会把非 force 请求排进 pending
    // 且此场景不会 replay（setSuspended 已是 false→false），于是刷新被静默丢弃。
    // 关闭瞬间 data-open 可能还没被 workflow 监听器清掉（监听器注册顺序），所以这里
    // 用 `force: true` 跳过 suspend+throttle，并失效书架资源确保读到最新文档。
    refreshScheduler.setSuspended(false);
    invalidateLibraryBooksResource(libraryBooksResource);
    refreshScheduler.scheduleRefresh({ delay: 300, force: true });
  }
  doc.addEventListener(APP_EVENTS.statusAreaVisibilityChanged, onStatusAreaVisibilityChanged);
  doc.addEventListener(APP_EVENTS.openTranslationWorkflow, onOpenTranslationWorkflow);
  doc.addEventListener(APP_EVENTS.closeTranslationWorkflow, onCloseTranslationWorkflow);

  return {
    commandSubscription,
    librarySubscription,
    dispose() {
      doc.removeEventListener(APP_EVENTS.statusAreaVisibilityChanged, onStatusAreaVisibilityChanged);
      doc.removeEventListener(APP_EVENTS.openTranslationWorkflow, onOpenTranslationWorkflow);
      doc.removeEventListener(APP_EVENTS.closeTranslationWorkflow, onCloseTranslationWorkflow);
      commandSubscription?.destroy?.();
      librarySubscription?.destroy?.();
      refreshScheduler?.dispose?.();
      runtime?.recentJobsLoader?.dispose?.();
      // RecentJobsRuntime 的 activeRefreshLoop 类型未声明 dispose（运行时实际有），此处按实际能力收窄。
      (runtime?.activeRefreshLoop as { dispose?: () => void } | null)?.dispose?.();
    },
  };
}
