// initialize / dispose：A9 壳生命周期唯一收口（事件绑定 + idle 视图 + startup 路由）。
//
// 启动顺序（见 entry.tsx / shell-boot.ts）：
//   1. composition：建 state/view → createBridge（窄回调桥）→ 各域挂 features →
//      workflowDialog.bindEvents（先于 recent-jobs，见 create-home-composition 注释）→
//      createRuntimeFeatures（job-runtime / recent-jobs / artifacts 一次挂齐）→ createLifecycle。
//      特性在 createRuntimeFeatures 已挂好；workflow 对话框事件在 composition
//      里先于 recent-jobs 绑定（见 composition.js 注释）。
//   2. bridge：随 composition 建好（无独立启动步），被 initializeIdleView 经端口消费。
//   3. initialize()：bindDocumentEvents（retryStage / returnHome）→
//      applyStartupRoute（reader/job_id/活动任务 → startPolling 恢复）→
//      initializeIdleView（经 bridge 落 idle store，可重复调）。
//   4. createRoot().render（mountShellPage：bootTheme → 找根 → 挂载，不开 StrictMode）。
//
// 销毁顺序（initialize 的逆序）：
//   disposeWorkflowDialogEvents → disposeDocumentEvents（解绑 retryStage / returnHome）→
//   jobRuntimeFeature.stopPolling()。事件生产者/消费者对照见 js/contracts/app-contract.ts。

import { mountedFeature } from "./feature-registry.js";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";
import { requestedReaderJobIdFromLocation } from "@/features/reader/domain.js";
import { readActiveJobId } from "@/features/jobs/index.js";
import { isMockMode } from "@/platform/config/runtime.js";
import { parseDetailJobId } from "@/platform/navigation/pages.js";

import type { HomeBridge, HomeFeatures } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasRecordDetail(event: Event): event is CustomEvent<Record<string, unknown>> {
  return "detail" in event && isRecord(event.detail);
}

type CreateLifecycleArgs = {
  features: HomeFeatures;
  bridge: HomeBridge;
  documentRef: Document;
  disposeWorkflowDialogEvents?: (() => void) | null;
  disposeArtifactDownloadsEvents?: (() => void) | null;
};

export function createLifecycle({
  features,
  bridge,
  documentRef,
  disposeWorkflowDialogEvents,
  disposeArtifactDownloadsEvents,
}: CreateLifecycleArgs) {
  let disposeDocumentEvents: (() => void) | null = null;
  let started = false;

  function initializeIdleView() {
    initializeIdleAppView({
      configPort: defaultAppShellConfigPort,
      setText: bridge.setText,
      setWorkflowSections: bridge.setWorkflowSections,
      renderPageRangeSummary: bridge.renderPageRangeSummary,
      resetUploadProgress: bridge.resetUploadProgress,
      resetUploadedFile: bridge.resetUploadedFile,
      applyWorkflowMode: bridge.applyWorkflowMode,
      updateJobWarning: bridge.updateJobWarning,
      activateDetailTab: bridge.activateDetailTab,
    });
  }

  function bindDocumentEvents() {
    const onRetryStage = (event: Event) => {
      const detail = hasRecordDetail(event) ? event.detail : {};
      const stage = `${detail.stage || ""}`.trim();
      const jobId = `${detail.jobId || detail.job_id || ""}`.trim();
      if (stage) mountedFeature(features, "jobRuntimeFeature").retryStage(stage, jobId ? { jobId } : {});
    };
    const onReturnHome = () => mountedFeature(features, "jobRuntimeFeature").returnToHome();
    documentRef.addEventListener(APP_EVENTS.retryStage, onRetryStage);
    documentRef.addEventListener(APP_EVENTS.returnHome, onReturnHome);
    return () => {
      documentRef.removeEventListener(APP_EVENTS.retryStage, onRetryStage);
      documentRef.removeEventListener(APP_EVENTS.returnHome, onReturnHome);
    };
  }

  function applyStartupRoute() {
    const fromReader = requestedReaderJobIdFromLocation();
    const fromQuery = parseDetailJobId();
    const fromActiveSession = readActiveJobId();
    const jobId = fromReader || fromQuery || fromActiveSession;
    if (!jobId) return;
    // 普通首页刷新没有 job_id 查询参数。此时必须从持久化的活动任务恢复
    // currentJobStore，否则后台仍在执行，详情页却会表现成“任务断开”。
    mountedFeature(features, "jobRuntimeFeature").startPolling(jobId, fromActiveSession && !fromReader && !fromQuery
      ? { silent: true, showWorkflow: false, publishLibrary: false, recovering: true }
      : undefined);
  }

  function initialize() {
    if (!started) {
      disposeDocumentEvents = bindDocumentEvents();
      started = true;
      applyStartupRoute();
    }
    initializeIdleView();
  }

  // 销毁顺序是**显式声明**的，不是 initialize 的机械倒放。
  //
  // 关键在第一条：workflowDialog 的 closeTranslationWorkflow 监听会触发
  // recent-jobs 的 scheduleRefresh，所以必须先解绑它，否则后面每解绑一个消费者
  // 都可能再被它唤起一轮。整体是「先解绑消费者、再停生产者」——stopPolling 放
  // 最后，保证轮询终止事件不会打到已失效的视图上。
  //
  // 写成一张具名表而不是一串语句：顺序本身是跨 4 个域的契约，散在语句里只有
  // 注释在维持它；一旦有人插一行或调个位置，不会有任何东西报错。
  function disposeSteps(): Array<[string, (() => void) | null | undefined]> {
    return [
      ["workflowDialogEvents", disposeWorkflowDialogEvents],
      ["documentEvents", disposeDocumentEvents],
      ["recentJobsEvents", features.recentJobsFeature?.disposeFeatureEvents],
      ["artifactDownloadsEvents", disposeArtifactDownloadsEvents],
      ["jobRuntimePolling", features.jobRuntimeFeature?.stopPolling],
    ];
  }

  function dispose() {
    for (const [name, step] of disposeSteps()) {
      if (typeof step !== "function") continue;
      try {
        step();
      } catch (error) {
        // 一个域解绑失败不得让后面的域漏解绑（否则泄漏面积随失败位置而变）。
        console.error(`home dispose step "${name}" failed:`, error);
      }
    }
    disposeDocumentEvents = null;
    started = false;
  }

  return {
    initialize,
    dispose,
  };
}

// ── idle 首帧：把主页外壳（上传区 / 页码 / 工作流 / 状态详情弹窗的页签）打回空态。 ──
//
// 原在 src/js/features/app-shell/idle-reset.ts + config-port.ts，后拆到 idle-view.ts；
// 现并入本文件与 initialize/dispose 同住（idle 视图是壳生命周期的一环）。
//   - createAppShellConfigPort 存在的唯一目的就是把 isMock 喂给
//     initializeIdleAppView（mock 模式下才清 error-box），没有第二个消费方。

export function createAppShellConfigPort({
  isMock = isMockMode,
}: { isMock?: () => boolean } = {}) {
  return {
    isMock,
  };
}

export const defaultAppShellConfigPort = createAppShellConfigPort();

export function initializeIdleAppView({
  configPort,
  setText,
  setWorkflowSections,
  renderPageRangeSummary,
  resetUploadProgress,
  resetUploadedFile,
  applyWorkflowMode,
  updateJobWarning,
  activateDetailTab,
}: {
  configPort?: { isMock?: () => boolean };
  setText: (id: string, value: string) => void;
  setWorkflowSections: (job: unknown) => void;
  renderPageRangeSummary: () => void;
  resetUploadProgress: () => void;
  resetUploadedFile: () => void;
  applyWorkflowMode: () => void;
  updateJobWarning: (mode: string) => void;
  activateDetailTab: (name?: string) => void;
}) {
  // 以前这里还往文字仓库写首页旧状态卡的摘要 / 阶段 / 耗时、状态详情弹窗的 18 个
  // 运行时与失败字段，再调三个空函数（进度条、操作按钮、事件列表）。旧状态卡早已
  // 下线，弹窗的字段由它自己的 store 渲染，文字仓库只有 error-box 有人读——都删了。
  setWorkflowSections(null);
  activateDetailTab("overview");
  if (configPort?.isMock?.()) {
    setText("error-box", "-");
  }
  renderPageRangeSummary();
  resetUploadProgress();
  resetUploadedFile();
  applyWorkflowMode();
  updateJobWarning("idle");
}
