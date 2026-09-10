import {
  clearActiveJobId,
  writeActiveJobId,
} from "./active-job-storage.js";
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
  JOB_POLL_INTERVAL_MS,
} from "./runtime-polling-state.js";
import {
  notifyLibraryJobUpdated,
  requestLibraryRefresh,
} from "./library-events.js";
import { createSecondaryResourceSchedulerPort } from "./secondary-resources.js";
import { returnJobRuntimeToHome } from "./runtime-reset.js";
import { createJobRuntimeShellViewPort } from "./shell-view-port.js";
import { createJobRuntimeResetStatePort } from "./reset-state-port.js";

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
}: any) {
  const normalizeJobPayload = jobPresentationPort?.normalizeJobPayload || ((value) => value || {});
  const isTerminalStatus = jobPresentationPort?.isTerminalStatus || ((status) => status === "failed" || status === "canceled");
  const isJobTerminal = jobPresentationPort?.isJobTerminal || ((value: any = {}) => isTerminalStatus(value?.status || value));
  // 当前轮询会话是否向图书馆广播进度补丁。
  // silent：不全量刷库，但 status/stage 变化仍同步（封面转圈 / 完成「已翻译」）。
  // 编排总览（fetch→render→publish→schedule，状态机见 runtime-polling-state.ts）：
  // ```
  // fetchJob: beginPoll → fetchPayload → finishPoll → isCurrent?丢弃
  //   → render(applySnapshot+renderJob) → publish(notifyLibrary)
  //   → settleTerminal(stop) → schedule(副资源) → refill(合并拍补发)
  // startPolling: stop旧轮 → startJob → 首帧render+publish → fetchJob → startTimer
  // ```
  let sessionPublishLibrary = true;
  /** silent 下上次已推到书架的 status|stage，用于跳过同态重复 notify */
  let lastLibraryPublishKey = "";

  function libraryPublishKeyOf(job: any = {}) {
    const status = `${job?.status || ""}`.trim();
    const stage = `${job?.display_stage || job?.stage || ""}`.trim();
    return `${job?.job_id || ""}|${status}|${stage}`;
  }

  /** 编排步骤：组占位首帧（startPolling 用，逻辑原样搬运）。 */
  function buildPlaceholderJob(jobId: string, startedAt: string, seed: any) {
    return seed
      ? {
          ...seed,
          job_id: jobId,
          // 重试首帧强制 running，避免仍显示「已翻译」不转圈
          status: seed.status && seed.status !== "succeeded"
            ? seed.status
            : "running",
          library_only: false,
          created_at: seed.created_at || startedAt,
          started_at: seed.started_at || startedAt,
        }
      : {
          job_id: jobId,
          status: "queued",
          stage: "queued",
          display_stage: "ocr",
          lane: "main",
          current_stage: "queued",
          stage_detail: "正在读取任务状态...",
          created_at: startedAt,
          started_at: startedAt,
        };
  }

  /** 编排步骤：render——读副资源缓存 + applySnapshot + renderJob。 */
  function renderFetchedFrame(jobId: string, payload: any) {
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

  /** 编排步骤：publish——主 poll 推书架（全量/终态/状态变化才推）。 */
  function publishFetchedJob(job: any, terminal: boolean) {
    const publishKey = libraryPublishKeyOf(job);
    // 全量 publish：每次 poll；silent：仅 status/stage 变化或终态（封面转圈要靠 status=running）
    if (sessionPublishLibrary || terminal || publishKey !== lastLibraryPublishKey) {
      lastLibraryPublishKey = publishKey;
      notifyLibraryJobUpdated(job, { port: libraryEventPort });
    }
  }

  /** 编排步骤：终态收尾——后置副作用 + stop；返回副资源调度代。 */
  function settleTerminalJob(jobId: string, job: any, generation: number) {
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

  /** 编排步骤：schedule——副资源调度 + 合并拍补发。 */
  function scheduleFetchedFrame(jobId: string, payload: any, scheduleGeneration: number, terminal: boolean, coalesced: boolean) {
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

  function handleFetchFailure(jobId: string, error: any, { recovering = false } = {}) {
    const currentJobId = `${currentJobPort.jobId?.() || ""}`.trim();
    // A rejected request from an older polling generation must never stop or
    // overwrite the task the user has just opened.
    if (currentJobId && currentJobId !== jobId) return;
    const missing = Number(error?.status) === 404;
    if (missing) {
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
    }
    setText("error-box", error?.message || String(error));
  }

  async function fetchJob(jobId) {
    const generation = pollingPort.beginPoll();
    if (generation === null || generation === undefined) {
      return;
    }
    let payload;
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
    renderFetchedFrame(jobId, payload);
    const job = normalizeJobPayload(payload);
    const terminal = isJobTerminal(job);
    publishFetchedJob(job, terminal);
    if (shellViewPort.isReaderOpen()) {
      onReaderDialogSync?.();
    }
    const { scheduleGeneration } = settleTerminalJob(jobId, job, generation);
    scheduleFetchedFrame(jobId, payload, scheduleGeneration, terminal, coalesced);
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
    sessionPublishLibrary = publishLibrary;
    const recovering = Boolean(options.recovering);
    lastLibraryPublishKey = "";

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
    lastLibraryPublishKey = libraryPublishKeyOf(normalizedPlaceholder);
    notifyLibraryJobUpdated(normalizedPlaceholder, { port: libraryEventPort });
    fetchJob(jobId).catch((err) => {
      handleFetchFailure(jobId, err, { recovering });
    });
    const timerGeneration = pollingPort.getSnapshot?.()?.generation ?? 0;
    pollingPort.startTimer(() => {
      if (pollingPort.isCurrentGeneration && !pollingPort.isCurrentGeneration(jobId, timerGeneration)) {
        return;
      }
      fetchJob(jobId).catch((err) => {
        handleFetchFailure(jobId, err, { recovering });
      });
    }, JOB_POLL_INTERVAL_MS);
  }

  function returnToHome() {
    returnJobRuntimeToHome({
      state,
      onReaderDialogClose,
      setWorkflowSections,
      resetUploadProgress,
      resetUploadedFile,
      applyWorkflowMode,
      clearPageRanges,
      setText,
      updateJobWarning,
      activateDetailTab,
      uploadStatePort,
      shellViewPort,
      jobPresentationPort,
    });
  }

  async function cancelCurrentJob() {
    const jobId = currentJobPort.jobId();
    if (!jobId) {
      setText("error-box", "当前没有可取消的任务");
      return;
    }
    shellViewPort.setCancelDisabled(true);
    try {
      const snapshot = currentJobPort.snapshot?.() || {};
      const job = snapshot?.job && typeof snapshot.job === "object" ? snapshot.job : snapshot;
      const raw = job?.raw_response && typeof job.raw_response === "object" ? job.raw_response : job;
      const workflow = `${snapshot?.workflow || job?.workflow || raw?.workflow || ""}`.trim();
      const cancel = workflow === "ocr" ? cancelOcrJob : cancelJob;
      if (typeof cancel !== "function") {
        throw new Error("任务取消接口未注入");
      }
      await cancel(jobId, apiPrefix);
      await fetchJob(jobId);
    } catch (err) {
      // 请求失败时允许用户重试；成功时保持锁定，直到权威状态变为 canceled。
      shellViewPort.setCancelDisabled(false);
      setText("error-box", err.message);
    }
  }

  async function retryStage(stage, options: { jobId?: string } = {}) {
    const normalizedStage = `${stage || ""}`.trim();
    // 优先事件带的 jobId → 当前轮询 → 上次 snapshot（详情卡上点重试时可能尚未 currentJobId）
    const jobId = `${
      options.jobId
      || currentJobPort.jobId()
      || currentJobPort.snapshot?.()?.job_id
      || ""
    }`.trim();
    if (!jobId || !normalizedStage) {
      setText("error-box", "当前没有可重新执行的阶段");
      return;
    }
    try {
      setText("error-box", "-");
      // statusCard snapshot 顶层无 document_id；身份在 job / raw_response 里
      const prevSnapshot = (currentJobPort.snapshot?.() || {}) as Record<string, unknown>;
      const prevJob = (
        (prevSnapshot.job && typeof prevSnapshot.job === "object" ? prevSnapshot.job : null)
        || prevSnapshot
      ) as Record<string, unknown>;
      const prevRaw = (
        (prevJob.raw_response && typeof prevJob.raw_response === "object" ? prevJob.raw_response : null)
        || prevJob
      ) as Record<string, unknown>;
      const pickBook = (...keys: string[]) => {
        for (const key of keys) {
          for (const source of [prevSnapshot, prevJob, prevRaw]) {
            const value = `${source?.[key] ?? ""}`.trim();
            if (value) return value;
          }
        }
        return "";
      };
      const bookMeta = {
        document_id: pickBook("document_id"),
        title: pickBook("title", "display_name"),
        display_name: pickBook("display_name", "title"),
        page_count: prevSnapshot.page_count ?? prevJob.page_count ?? prevRaw.page_count,
        cover_url: pickBook("cover_url"),
        thumbnail_url: pickBook("thumbnail_url"),
      };
      const result = await retryJobStage(jobId, apiPrefix, normalizedStage, bookMeta);
      const nextJobId = `${result?.job_id || jobId}`.trim();
      if (nextJobId) {
        // 进度字段用 result；书目元数据优先 bookMeta（避免 Mock 重试标题盖掉书名）
        const seed = normalizeJobPayload({
          ...result,
          job_id: nextJobId,
          source_job_id: jobId,
          document_id: result?.document_id || bookMeta.document_id,
          title: bookMeta.title || result?.title,
          display_name: bookMeta.display_name || bookMeta.title || result?.display_name,
          cover_url: bookMeta.cover_url || result?.cover_url,
          thumbnail_url: bookMeta.thumbnail_url || result?.thumbnail_url,
          page_count: bookMeta.page_count ?? result?.page_count,
          library_only: false,
          active_job_id: nextJobId,
        });
        // 详情 Tab 内重试：silent + 首帧用 fromStage 结果；必须带 document_id/source_job_id
        startPolling(nextJobId, {
          silent: true,
          showWorkflow: false,
          publishLibrary: false,
          seedPayload: {
            ...seed,
            source_job_id: jobId,
            document_id: seed.document_id || bookMeta.document_id,
            title: seed.title || bookMeta.title,
            display_name: seed.display_name || bookMeta.display_name || bookMeta.title,
            cover_url: seed.cover_url || bookMeta.cover_url,
            thumbnail_url: seed.thumbnail_url || bookMeta.thumbnail_url,
            status: seed.status && seed.status !== "succeeded" ? seed.status : "running",
          },
        });
        // startPolling 已 notify 一帧 running，此处不必重复
      } else {
        await fetchJob(jobId);
      }
    } catch (err) {
      setText("error-box", err.message || String(err));
    }
  }

  return {
    cancelCurrentJob,
    currentJobId: () => currentJobPort.jobId(),
    fetchJob,
    retryStage,
    returnToHome,
    startPolling,
    stopPolling: () => pollingPort.stop(),
  };
}
