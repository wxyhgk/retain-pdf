import type { JobLike, JobPayload } from "@retainpdf/domain/job";
import type { JobPollSession } from "./poll-session.js";
import type { JobRenderContext, JobRenderContextPort } from "./render-context.js";
import type { LibraryEventPort } from "./library-events.js";
import type { RuntimePollingStatePort } from "./runtime-polling-state.js";
import type { SecondaryResourcePort } from "./secondary-resources.js";
import { clearActiveJobId } from "./active-job-storage.js";
import { notifyLibraryJobUpdated } from "./library-events.js";
import {
  libraryPublishKeyOf,
  shouldPublishLibrary,
} from "./poll-placeholder.js";

/**
 * 单帧轮询的编排步骤：render（读副资源缓存 + applySnapshot + renderJob）、
 * publish（按会话模式推书架）、settle（终态收尾）。
 * 依赖全部显式传入；会话可变状态从 session 读写。
 */
/** 单帧编排依赖：副资源缓存 / 渲染端口 / 书架端口 / 轮询状态 / 会话 */
export interface JobPollFrameStepsDeps {
  secondaryResourcePort: SecondaryResourcePort;
  renderContextPort: JobRenderContextPort;
  renderJob: (context: JobRenderContext) => void;
  libraryEventPort?: LibraryEventPort;
  isJobTerminal: (job: JobLike | JobPayload) => boolean;
  onJobSucceeded?: (job: JobLike | JobPayload) => unknown;
  pollingPort: RuntimePollingStatePort;
  session: JobPollSession;
}

export function createJobPollFrameSteps({
  secondaryResourcePort,
  renderContextPort,
  renderJob,
  libraryEventPort,
  isJobTerminal,
  onJobSucceeded,
  pollingPort,
  session,
}: JobPollFrameStepsDeps) {
  /** render——读副资源缓存 + applySnapshot + renderJob。 */
  function renderFetchedFrame(jobId: string, payload: unknown) {
    const cachedEvents = secondaryResourcePort.cachedFor("events", jobId);
    const cachedManifest = secondaryResourcePort.cachedFor("manifest", jobId);
    const cachedStageActions = secondaryResourcePort.cachedFor("stageActions", jobId);
    const renderContext = renderContextPort.applySnapshot({
      payload,
      eventsPayload: cachedEvents,
      manifestPayload: cachedManifest,
      stageActionsPayload: cachedStageActions,
    });
    // 进度主场：statusCardStore（主卡 / 详情嵌入卡共用）
    renderJob(renderContext);
  }

  /** publish——主 poll 推书架（全量/终态/状态变化才推）。 */
  function publishFetchedJob(job: JobLike, terminal: boolean) {
    const publishKey = libraryPublishKeyOf(job);
    if (shouldPublishLibrary(
      session.publishLibrary,
      terminal,
      publishKey,
      session.lastLibraryPublishKey,
    )) {
      session.lastLibraryPublishKey = publishKey;
      notifyLibraryJobUpdated(job, { port: libraryEventPort });
    }
  }

  /** 终态收尾——后置副作用 + stop；返回副资源调度代。 */
  function settleTerminalJob(jobId: string, job: JobLike, generation: number) {
    const terminal = isJobTerminal(job);
    if (terminal) {
      if (`${job?.status || ""}`.trim().toLowerCase() === "succeeded") {
        // Metadata enrichment is a detached post-success side effect. It must
        // never keep polling alive or turn a completed job into a UI failure.
        void Promise.resolve(onJobSucceeded?.(job)).catch(() => {});
      }
      // 终态无视 5s 节流：直发 force 刷新，不走节流的 requestLibraryRefresh。
      libraryEventPort?.requestRefresh?.({ delay: 200, force: true });
      clearActiveJobId(jobId);
      pollingPort.stop();
    }
    // stop() 会涨 generation：终态副资源抓取必须用停之后的新代，
    // 否则 isCurrentGeneration 校验失配，manifest 拉回来也被丢掉。
    return {
      terminal,
      scheduleGeneration: terminal
        ? Number(pollingPort.getSnapshot?.()?.generation ?? generation) || generation
        : generation,
    };
  }

  return { renderFetchedFrame, publishFetchedJob, settleTerminalJob };
}
