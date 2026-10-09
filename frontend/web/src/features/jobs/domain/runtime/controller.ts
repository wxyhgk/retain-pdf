import type { JobLike, JobPayload } from "@retainpdf/domain/job";
import type { fetchJobEvents as FetchJobEvents } from "@retainpdf/api/jobs-events";
import type { CurrentJobStatePort } from "./current-job-state.js";
import type { JobEventsResource } from "./job-events-resource.js";
import type { JobPresentationPort } from "./job-presentation.js";
import type { JobRenderContext, JobRenderContextPort } from "./render-context.js";
import type { JobRuntimeResetStatePort, JobRuntimeResetTarget } from "./reset-state-port.js";
import type { LibraryEventPort } from "./library-events.js";
import type { RuntimePollingStatePort } from "./runtime-polling-state.js";
import type { SecondaryResourcePort, SecondaryResourceSchedulerPort } from "./secondary-resources.js";
import type { RetryStageDeps } from "./retry-stage.js";
// job-runtime 的装配根。业务按职责拆到同目录聚焦模块：
// - poll-engine.ts       轮询状态机（timer / 可见性暂停 / 失败退避 / fetch 编排）
// - poll-frame-steps.ts  单帧 render / publish / settle 编排步骤
// - poll-placeholder.ts  占位首帧与书架发布键（纯函数）
// - poll-session.ts      一轮轮询的可变会话状态
// - cancel-job.ts        取消当前任务
// - retry-stage.ts       阶段重试与书目元数据解析
// - job-presentation.ts  展示谓词（normalize / terminal）装配
// 本文件只负责：解析可注入依赖端口、实例化各 factory、拼出对外返回对象。

import {
  createJobEventsResource,
} from "./job-events-resource.js";
import { createCurrentJobStatePort } from "./current-job-state.js";
import { createSecondaryResourceStatePort } from "./secondary-resource-cache.js";
import {
  createJobRenderContextPort,
} from "./render-context.js";
import {
  createRuntimePollingStatePort,
} from "./runtime-polling-state.js";
import {
  notifyLibraryJobUpdated,
} from "./library-events.js";
import { createSecondaryResourceSchedulerPort } from "./secondary-resources.js";
import { returnJobRuntimeToHome } from "./runtime-reset.js";
import { createJobRuntimeShellViewPort } from "./shell-view-port.js";
import { createJobRuntimeResetStatePort } from "./reset-state-port.js";
import { createJobPresentation } from "./job-presentation.js";
import { createJobPollSession } from "./poll-session.js";
import { createJobPollFrameSteps } from "./poll-frame-steps.js";
import { createJobPollEngine } from "./poll-engine.js";
import { createCancelCurrentJob } from "./cancel-job.js";
import { createRetryStage } from "./retry-stage.js";

/** 轮询装配根的依赖：composition 注入的接口 / 渲染回调 / 页面端口；可替换的内部端口可缺省 */
export interface JobRuntimeFeatureDeps {
  state: JobRuntimeResetTarget;
  apiPrefix?: string;
  cancelJob?: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  cancelOcrJob?: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  fetchJobPayload: (jobId: string, options: { apiPrefix?: string }) => Promise<unknown>;
  fetchJobEvents: typeof FetchJobEvents;
  fetchJobArtifactsManifest: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  fetchJobStageActions?: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  retryJobStage: RetryStageDeps["retryJobStage"];
  renderJob: (context: JobRenderContext) => void;
  renderJobSecondaryPatch?: (patch: { context: unknown; source: string }) => void;
  setText: (id: string, message: string) => void;
  setWorkflowSections: (job: unknown) => void;
  resetUploadProgress: () => void;
  resetUploadedFile: () => void;
  applyWorkflowMode: (mode?: string) => void;
  clearPageRanges: () => void;
  updateJobWarning: (warning: unknown) => void;
  activateDetailTab: (tab: string) => void;
  onReaderDialogSync?: () => void;
  onReaderDialogClose?: () => void;
  onJobSucceeded?: (job: JobLike | JobPayload) => unknown;
  /** 上传态端口只原样转交给 returnJobRuntimeToHome，本文件不读取 */
  uploadStatePort?: { clearAppliedPageRange?: () => void } | null;
  libraryEventPort?: LibraryEventPort;
  shellViewPort?: {
    closeDialogs: () => void;
    isReaderOpen: () => boolean;
    setCancelDisabled: (disabled: boolean) => void;
  };
  jobPresentationPort?: JobPresentationPort;
  jobEventsResource?: JobEventsResource;
  pollingPort?: RuntimePollingStatePort;
  currentJobPort?: CurrentJobStatePort;
  secondaryResourcePort?: SecondaryResourcePort;
  resetStatePort?: JobRuntimeResetStatePort;
  renderContextPort?: JobRenderContextPort;
  secondaryResourceSchedulerPort?: SecondaryResourceSchedulerPort;
}

export function mountJobRuntimeFeature({
  state,
  apiPrefix,
  cancelJob,
  cancelOcrJob,
  fetchJobPayload,
  fetchJobEvents,
  fetchJobArtifactsManifest,
  fetchJobStageActions,
  retryJobStage,
  renderJob,
  renderJobSecondaryPatch,
  setText,
  setWorkflowSections,
  resetUploadProgress,
  resetUploadedFile,
  applyWorkflowMode,
  clearPageRanges,
  updateJobWarning,
  activateDetailTab,
  onReaderDialogSync,
  onReaderDialogClose,
  onJobSucceeded,
  uploadStatePort,
  libraryEventPort,
  jobEventsResource = createJobEventsResource({ fetchJobEvents, apiPrefix }),
  pollingPort = createRuntimePollingStatePort(state),
  currentJobPort = createCurrentJobStatePort(state),
  secondaryResourcePort = createSecondaryResourceStatePort(state),
  shellViewPort = createJobRuntimeShellViewPort(),
  jobPresentationPort,
  resetStatePort = createJobRuntimeResetStatePort(state),
  renderContextPort = createJobRenderContextPort(state, { jobPresentationPort }),
  secondaryResourceSchedulerPort = createSecondaryResourceSchedulerPort({
    state,
    apiPrefix,
    fetchJobEvents,
    jobEventsResource,
    fetchJobArtifactsManifest,
    fetchJobStageActions,
    renderJobSecondaryPatch,
    notifyLibraryJobUpdated: (job) => notifyLibraryJobUpdated(job, { port: libraryEventPort }),
    pollingPort,
    currentJobPort,
    secondaryResourcePort,
    renderContextPort,
    jobPresentationPort,
  }),
}: JobRuntimeFeatureDeps) {
  const presentation = createJobPresentation({ jobPresentationPort });
  const session = createJobPollSession();
  const frameSteps = createJobPollFrameSteps({
    secondaryResourcePort,
    renderContextPort,
    renderJob,
    libraryEventPort,
    isJobTerminal: presentation.isJobTerminal,
    onJobSucceeded,
    pollingPort,
    session,
  });
  const engine = createJobPollEngine({
    state,
    apiPrefix,
    fetchJobPayload,
    pollingPort,
    currentJobPort,
    resetStatePort,
    shellViewPort,
    renderContextPort,
    renderJob,
    secondaryResourceSchedulerPort,
    libraryEventPort,
    normalizeJobPayload: presentation.normalizeJobPayload,
    isJobTerminal: presentation.isJobTerminal,
    session,
    frameSteps,
    setText,
    setWorkflowSections,
    onReaderDialogSync,
  });
  const cancelCurrentJob = createCancelCurrentJob({
    currentJobPort,
    shellViewPort,
    setText,
    cancelJob,
    cancelOcrJob,
    apiPrefix,
    fetchJob: engine.fetchJob,
  });
  const retryStage = createRetryStage({
    retryJobStage,
    apiPrefix,
    currentJobPort,
    setText,
    normalizeJobPayload: presentation.normalizeJobPayload,
    startPolling: engine.startPolling,
    fetchJob: engine.fetchJob,
  });

  function returnToHome() {
    returnJobRuntimeToHome({
      state,
      onReaderDialogClose,
      setWorkflowSections,
      resetUploadProgress,
      resetUploadedFile,
      applyWorkflowMode,
      clearPageRanges,
      updateJobWarning,
      activateDetailTab,
      uploadStatePort,
      shellViewPort,
    });
  }

  return {
    cancelCurrentJob,
    currentJobId: () => currentJobPort.jobId(),
    fetchJob: engine.fetchJob,
    retryStage,
    returnToHome,
    startPolling: engine.startPolling,
    stopPolling: engine.stopPolling,
  };
}
