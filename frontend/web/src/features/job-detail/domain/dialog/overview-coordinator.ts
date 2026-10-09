import type {
  StatusDetailOverviewPayloadOptions,
  StatusDetailRuntimePort,
} from "../status-detail-runtime-port.js";
import type { StatusDetailOverviewRenderContext } from "./controller-types.js";
import type { StatusDetailRenderContext } from "@/platform/contracts/status-detail-runtime-contract.js";

/** 概览 coordinator 的依赖：运行时端口 + 各路拉取接口 + 渲染回调 */
export interface StatusDetailOverviewCoordinatorDeps {
  runtimePort: StatusDetailRuntimePort;
  apiPrefix?: string;
  fetchJobPayload?: (jobId: string, options?: { apiPrefix?: string }) => Promise<unknown>;
  fetchJobEvents?: (
    jobId: string,
    apiPrefix: string,
    query: { limit: number; start: "tail" | "head" },
  ) => Promise<unknown>;
  fetchJobDiagnostics?: (jobId: string, apiPrefix: string) => Promise<unknown>;
  fetchResumePlan?: (jobId: string, apiPrefix: string) => Promise<unknown>;
  fetchJobStageActions?: (jobId: string, apiPrefix: string) => Promise<unknown>;
  renderJob?: (context: StatusDetailOverviewRenderContext) => void;
  renderOverviewSnapshot: (context: StatusDetailOverviewRenderContext) => void;
  setErrorText?: (message: string) => void;
}

export function createStatusDetailOverviewCoordinator({
  runtimePort,
  apiPrefix = "",
  fetchJobPayload,
  fetchJobEvents,
  fetchJobDiagnostics,
  fetchResumePlan,
  fetchJobStageActions,
  renderJob,
  renderOverviewSnapshot,
  setErrorText,
}: StatusDetailOverviewCoordinatorDeps = {} as StatusDetailOverviewCoordinatorDeps) {
  const state = {
    loadingPromise: null as Promise<void> | null,
    loadingJobId: "",
  };

  function cachedContextFor(jobId: string) {
    const previousContext = runtimePort.currentRenderContext(jobId);
    if (previousContext.job) {
      return previousContext;
    }
    return {
      ...previousContext,
      job: runtimePort.currentJobSnapshot() || { job_id: jobId },
    };
  }

  async function loadFreshContext(jobId: string, previousContext: StatusDetailRenderContext) {
    const [payload, eventsPayload, diagnosticsPayload, resumePlan, stageActionsPayload] = await Promise.all([
      fetchJobPayload ? fetchJobPayload(jobId, { apiPrefix }) : Promise.resolve(previousContext.job),
      fetchJobEvents ? fetchJobEvents(jobId, apiPrefix, { limit: 500, start: "tail" }).catch(() => previousContext.events) : Promise.resolve(previousContext.events),
      fetchJobDiagnostics ? fetchJobDiagnostics(jobId, apiPrefix).catch(() => null) : Promise.resolve(null),
      fetchResumePlan ? fetchResumePlan(jobId, apiPrefix).catch(() => null) : Promise.resolve(null),
      fetchJobStageActions ? fetchJobStageActions(jobId, apiPrefix).catch(() => null) : Promise.resolve(null),
    ]);
    if (!runtimePort.isCurrentJob(jobId)) {
      return null;
    }
    // 拉取函数的回包在 deps 里是 unknown，这里按概览载荷形状收窄（与 applyOverviewPayload 入参一致）。
    return runtimePort.applyOverviewPayload({
      payload: payload as StatusDetailOverviewPayloadOptions["payload"],
      eventsPayload: eventsPayload as StatusDetailOverviewPayloadOptions["eventsPayload"],
      diagnosticsPayload,
      resumePlan,
      stageActionsPayload,
      fallbackJobId: jobId,
    });
  }

  async function ensureLoaded({ force = false }: { force?: boolean } = {}) {
    const jobId = runtimePort.currentJobId();
    if (!jobId) {
      return;
    }
    // loadingPromise 绑定 jobId：切任务后不得复用旧任务的 in-flight 刷新。
    if (state.loadingPromise && !force && state.loadingJobId === jobId) {
      await state.loadingPromise;
      return;
    }
    const previousContext = runtimePort.currentRenderContext(jobId);
    renderOverviewSnapshot(cachedContextFor(jobId));
    state.loadingJobId = jobId;
    state.loadingPromise = (async () => {
      try {
        const renderContext = await loadFreshContext(jobId, previousContext);
        if (!renderContext) {
          return;
        }
        // runtimePort 返回的 events 在 platform 契约里是 unknown，这里按概览上下文收窄。
        renderJob?.(renderContext);
        renderOverviewSnapshot(renderContext);
      } catch (error) {
        setErrorText?.((error as { message?: string } | null)?.message || String(error));
      } finally {
        // 旧任务的 finally 不得清除新任务发起的刷新。
        if (state.loadingJobId === jobId) {
          state.loadingPromise = null;
          state.loadingJobId = "";
        }
      }
    })();
    await state.loadingPromise;
  }

  return {
    ensureLoaded,
    cachedContextFor,
  };
}
