import { clearActiveJobId, writeActiveJobId } from "./active-job-storage.js";
import {
  notifyLibraryJobUpdated,
  requestLibraryRefresh,
} from "./library-events.js";
import {
  JOB_POLL_INTERVAL_MS,
  nextJobPollBackoffDelay,
} from "./runtime-polling-state.js";
import { buildPlaceholderJob, libraryPublishKeyOf } from "./poll-placeholder.js";
import type { JobLike, JobPayload } from "@retainpdf/domain/job";
import type { CurrentJobStatePort } from "./current-job-state.js";
import type { JobRuntimeResetStatePort } from "./reset-state-port.js";
import type { JobRenderContext, JobRenderContextPort } from "./render-context.js";
import type { LibraryEventPort } from "./library-events.js";
import type { JobPollSession } from "./poll-session.js";
import type { RuntimePollingStatePort } from "./runtime-polling-state.js";
import type { SecondaryResourceSchedulerPort } from "./secondary-resources.js";
import type { createJobPollFrameSteps } from "./poll-frame-steps.js";

/**
 * 轮询引擎：管理 timer / 可见性暂停 / 失败退避 / generation 围栏，
 * 编排单帧 fetch→render→publish→settle→schedule 的状态机
 * （状态转换详见 runtime-polling-state.ts）。
 *
 * 会话可变状态由 session 持有；单帧纯编排步骤由 frameSteps 提供。
 * 只暴露 startPolling / fetchJob / stopPolling 三个入口给装配根。
 */
/** 轮询引擎依赖（装配根 controller 注入） */
export interface JobPollEngineDeps {
  state: object;
  apiPrefix?: string;
  fetchJobPayload: (jobId: string, options: { apiPrefix?: string }) => Promise<unknown>;
  pollingPort: RuntimePollingStatePort;
  currentJobPort: CurrentJobStatePort;
  resetStatePort: JobRuntimeResetStatePort;
  shellViewPort: { setCancelDisabled: (disabled: boolean) => void; isReaderOpen: () => boolean };
  renderContextPort: JobRenderContextPort;
  renderJob: (context: JobRenderContext) => void;
  secondaryResourceSchedulerPort: SecondaryResourceSchedulerPort;
  libraryEventPort?: LibraryEventPort;
  normalizeJobPayload: (value: unknown) => JobPayload;
  isJobTerminal: (job: JobLike | JobPayload) => boolean;
  session: JobPollSession;
  frameSteps: ReturnType<typeof createJobPollFrameSteps>;
  setText: (id: string, message: string) => void;
  setWorkflowSections: (job: unknown) => void;
  onReaderDialogSync?: () => void;
}

export function createJobPollEngine({
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
  normalizeJobPayload,
  isJobTerminal,
  session,
  frameSteps,
  setText,
  setWorkflowSections,
  onReaderDialogSync,
}: JobPollEngineDeps) {
  let detachVisibilityPause: (() => void) | null = null;

  function pollDocument(): {
    visibilityState?: string;
    addEventListener?: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
  } | null {
    try {
      if (typeof document === "undefined") return null;
      // DOM Document 的测试替身只有子集字段，按结构取用，不碰完整 DOM 类型。
      return document as unknown as {
        visibilityState?: string;
        addEventListener?: (type: string, listener: () => void) => void;
        removeEventListener?: (type: string, listener: () => void) => void;
      };
    } catch {
      return null;
    }
  }

  /** 按给定间隔重启轮询 timer（带当前轮 generation 围栏 + 不可见跳拍）。 */
  function schedulePollTick(jobId: string, delayMs: number = JOB_POLL_INTERVAL_MS) {
    const timerGeneration = Number(pollingPort.getSnapshot?.()?.generation ?? 0) || 0;
    const recovering = session.recovering;
    pollingPort.startTimer(() => {
      if (pollingPort.isCurrentGeneration && !pollingPort.isCurrentGeneration(jobId, timerGeneration)) {
        return;
      }
      // 无 pauseTimer 的旧注入 port 也能靠跳拍避免后台刷请求
      if (pollDocument()?.visibilityState === "hidden") {
        return;
      }
      fetchJob(jobId).catch((err) => handleFetchFailure(jobId, err, { recovering }));
    }, delayMs);
  }

  /** 页面不可见暂停轮询（只清 timer 不涨代），可见恢复重启 + 补拉一次。 */
  function bindVisibilityPause(jobId: string) {
    detachVisibilityPause?.();
    detachVisibilityPause = null;
    const doc = pollDocument();
    if (!doc || typeof doc.addEventListener !== "function") return;
    const boundGeneration = Number(pollingPort.getSnapshot?.()?.generation ?? 0) || 0;
    const onVisibilityChange = () => {
      if (doc.visibilityState === "hidden") {
        try {
          pollingPort.pauseTimer?.();
        } catch {
          /* ignore */
        }
        return;
      }
      // 已停轮/换代后不再复活旧轮
      if (pollingPort.isCurrentGeneration && !pollingPort.isCurrentGeneration(jobId, boundGeneration)) {
        return;
      }
      schedulePollTick(
        jobId,
        session.failureCount > 0 ? nextJobPollBackoffDelay(session.failureCount) : JOB_POLL_INTERVAL_MS,
      );
      fetchJob(jobId).catch((err) => handleFetchFailure(jobId, err, { recovering: session.recovering }));
    };
    doc.addEventListener("visibilitychange", onVisibilityChange);
    detachVisibilityPause = () => {
      try {
        doc.removeEventListener?.("visibilitychange", onVisibilityChange);
      } catch {
        /* ignore */
      }
    };
  }

  function handleFetchFailure(jobId: string, error: unknown, { recovering = false } = {}) {
    const currentJobId = `${currentJobPort.jobId?.() || ""}`.trim();
    // A rejected request from an older polling generation must never stop or
    // overwrite the task the user has just opened.
    if (currentJobId && currentJobId !== jobId) return;
    const errorInfo = (error ?? {}) as { status?: unknown; message?: string };
    const missing = Number(errorInfo.status) === 404;
    if (missing) {
      session.failureCount = 0;
      session.errorVisible = false;
      detachVisibilityPause?.();
      detachVisibilityPause = null;
      clearActiveJobId(jobId);
      pollingPort.stop();
      currentJobPort.syncSnapshot?.(null, "", { startedAt: "", finishedAt: "" });
      resetStatePort.resetJob();
      // 终态无视节流：直发 force 刷新，不走 5s 节流的 requestLibraryRefresh。
      libraryEventPort?.requestRefresh?.({ delay: 200, force: true });
      if (recovering) {
        // 持久化恢复键允许跨刷新接回后台任务，但任务被删除、数据库被替换
        // 或 document.active_job_id 已过期时，它只是陈旧缓存，不应冒充用户错误。
        setText("error-box", "-");
        return;
      }
      setText("error-box", errorInfo.message || String(error));
      return;
    }
    session.failureCount += 1;
    session.errorVisible = true;
    setText("error-box", errorInfo.message || String(error));
    // 指数退避：重启 timer，下一次按 1s→2s→4s→8s→15s（封顶）拉长。
    schedulePollTick(jobId, nextJobPollBackoffDelay(session.failureCount));
  }

  async function fetchJob(jobId: string) {
    const generation = pollingPort.beginPoll();
    if (generation === null || generation === undefined) {
      return;
    }
    let payload: unknown;
    let coalesced = false;
    try {
      payload = await fetchJobPayload(jobId, { apiPrefix });
    } finally {
      // finishPoll 内部按 generation 守卫：失配直接返回 false，不清新轮询的 pollInFlight。
      coalesced = pollingPort.finishPoll(generation) === true;
    }
    // 旧 fetch 决议后 isCurrent 失配直接返回。
    if (!pollingPort.isCurrentGeneration(jobId, generation)) {
      return;
    }
    if (session.errorVisible || session.failureCount > 0) {
      // 成功只清本轮询挂起的横幅，不碰别处写的错；退避中的 timer 切回基准间隔。
      session.failureCount = 0;
      session.errorVisible = false;
      setText("error-box", "-");
      schedulePollTick(jobId, JOB_POLL_INTERVAL_MS);
    }
    frameSteps.renderFetchedFrame(jobId, payload);
    const job = normalizeJobPayload(payload);
    const terminal = isJobTerminal(job);
    frameSteps.publishFetchedJob(job, terminal);
    if (shellViewPort.isReaderOpen()) {
      onReaderDialogSync?.();
    }
    const { scheduleGeneration } = frameSteps.settleTerminalJob(jobId, job, generation);
    if (terminal) {
      detachVisibilityPause?.();
      detachVisibilityPause = null;
    }
    secondaryResourceSchedulerPort.schedule({
      jobId,
      payload,
      generation: scheduleGeneration,
      terminal,
    });
    // 在途合并的拍由 finishPoll 消费，这里补发一次（终态已停轮询，不补发）。
    if (coalesced && !terminal) {
      void fetchJob(jobId).catch((err) => handleFetchFailure(jobId, err));
    }
  }

  /**
   * @param {string} jobId
   * @param {{
   *   silent?: boolean,
   *   publishLibrary?: boolean,
   *   showWorkflow?: boolean,
   * }} [options]
   * - silent: 详情 Tab 等嵌入进度；不抬主工作流区、不广播 create、运行中不刷库
   * - publishLibrary / showWorkflow: 默认跟随 !silent
   */
  function startPolling(
    jobId: string,
    options: {
      silent?: boolean;
      publishLibrary?: boolean;
      showWorkflow?: boolean;
      /** 首帧 payload（重试时带 fromStage 结果，避免先闪「排队」） */
      seedPayload?: Record<string, unknown> | null;
      /** 刷新后从本地持久化状态恢复；404 代表陈旧缓存，应静默清理。 */
      recovering?: boolean;
    } = {},
  ) {
    const silent = Boolean(options.silent);
    const publishLibrary = options.publishLibrary ?? !silent;
    const showWorkflow = options.showWorkflow ?? !silent;
    session.publishLibrary = publishLibrary;
    const recovering = Boolean(options.recovering);
    session.lastLibraryPublishKey = "";
    session.failureCount = 0;
    session.errorVisible = false;
    session.recovering = recovering;

    pollingPort.stop();
    // 上一个任务的取消请求可能把按钮锁在 disabled；新任务必须拥有独立操作状态。
    shellViewPort.setCancelDisabled(false);
    writeActiveJobId(jobId);
    resetStatePort.resetSecondary();
    const { startedAt } = pollingPort.startJob(jobId);
    const seed = options.seedPayload && typeof options.seedPayload === "object"
      ? options.seedPayload
      : null;
    const placeholderJob = buildPlaceholderJob(jobId, startedAt, seed);
    if (showWorkflow) {
      setWorkflowSections(placeholderJob);
    }
    // 始终写 statusCardStore，供主卡 / 详情嵌入卡共用 snapshot
    renderJob(renderContextPort.applySnapshot({
      payload: placeholderJob,
    }));
    // 书架：全量模式照旧；silent 也要立刻推一帧 running，封面才能转圈
    const normalizedPlaceholder = normalizeJobPayload(placeholderJob);
    if (publishLibrary) {
      libraryEventPort?.publishJobCreated?.(normalizedPlaceholder);
      requestLibraryRefresh(state, { port: libraryEventPort });
    }
    session.lastLibraryPublishKey = libraryPublishKeyOf(normalizedPlaceholder);
    notifyLibraryJobUpdated(normalizedPlaceholder, { port: libraryEventPort });
    fetchJob(jobId).catch((err) => {
      handleFetchFailure(jobId, err, { recovering });
    });
    schedulePollTick(jobId, JOB_POLL_INTERVAL_MS);
    bindVisibilityPause(jobId);
  }

  function stopPolling() {
    detachVisibilityPause?.();
    detachVisibilityPause = null;
    pollingPort.stop();
  }

  return { startPolling, fetchJob, stopPolling };
}
