import type {
  StatusDetailRuntimePorts,
} from "@/platform/contracts/status-detail-runtime-contract.js";
import type {
  JobLike,
  JobPayload,
} from "@retainpdf/domain/job";
import type {
  EventsPayload,
} from "@retainpdf/domain/job-status";
import type { ResumePlanLike } from "./dialog/resume-actions.js";

// StatusDetailDialog 的 runtimePort(蓝图 §1 数据源铁律:读 job-runtime 保留
// 引擎的 state,不是 statusCardStore)。
//
// 三个 kept 端口(current-job-state / secondary-resource-cache / render-context)
// 由组合层从 features/jobs 构造后经参数注入(见
// platform/contracts/status-detail-runtime-contract.ts)。composition 传的是同一个
// jobRuntimeState,拿到与 job-runtime 引擎完全同一份 currentJobStore/
// secondaryResourceStore 引用,不新建平行状态;此处不 import features/jobs,
// 断开 jobs ⇄ job-detail 的循环值依赖。

/** applyOverviewPayload 入参：概览刷新后写回 runtime 的一批载荷 */
export interface StatusDetailOverviewPayloadOptions {
  payload?: JobLike | JobPayload | Record<string, unknown> | null;
  eventsPayload?: EventsPayload | null;
  diagnosticsPayload?: unknown;
  resumePlan?: unknown;
  stageActionsPayload?: unknown;
  fallbackJobId?: string;
}

export function createStatusDetailRuntimePort({
  currentJobPort,
  secondaryResourcePort,
  renderContextPort,
}: StatusDetailRuntimePorts) {
  return {
    currentJobId() {
      return currentJobPort.jobId();
    },
    currentJobSnapshot() {
      return currentJobPort.snapshot();
    },
    currentRenderContext(jobId: string) {
      return renderContextPort.currentFor(jobId);
    },
    currentJobFinishedAt() {
      return currentJobPort.finishedAt();
    },
    currentResumePlan(): ResumePlanLike | null {
      // platform 契约里 resumePlan 回包是 unknown；这里按断点计划结构收窄（缺字段时各读取点都有兜底）。
      return currentJobPort.resumePlan() as ResumePlanLike | null;
    },
    rerunContext() {
      return {
        job: currentJobPort.snapshot(),
        resumePlan: this.currentResumePlan(),
      };
    },
    cacheJobDiagnostics(jobId: string, payload: unknown) {
      currentJobPort.cacheDiagnostics(jobId, payload);
    },
    cacheJobResumePlan(jobId: string, payload: unknown) {
      currentJobPort.cacheResumePlan(jobId, payload);
    },
    cacheEvents(jobId: string, payload: unknown) {
      secondaryResourcePort.cache("events", jobId, payload);
    },
    isCurrentJob(jobId: string) {
      return this.currentJobId() === `${jobId || ""}`.trim();
    },
    applyOverviewPayload({
      payload,
      eventsPayload = null,
      diagnosticsPayload = null,
      resumePlan = null,
      stageActionsPayload = null,
      fallbackJobId = "",
    }: StatusDetailOverviewPayloadOptions = {}) {
      const context = renderContextPort.applySnapshot({
        payload: {
          ...(payload || {}),
          job_id: payload?.job_id || fallbackJobId,
        },
        eventsPayload,
        stageActionsPayload,
      });
      currentJobPort.cacheDiagnostics(context.jobId, diagnosticsPayload);
      currentJobPort.cacheResumePlan(context.jobId, resumePlan);
      if (context.job && diagnosticsPayload) {
        context.job = {
          ...context.job,
          diagnostics: diagnosticsPayload,
        };
        const currentSnapshot = currentJobPort.getSnapshot();
        currentJobPort.syncSnapshot(context.job, context.jobId, {
          startedAt: context.job.started_at || context.job.created_at || currentSnapshot.startedAt || "",
          finishedAt: context.job.finished_at || context.job.updated_at || currentSnapshot.finishedAt || "",
        });
      }
      return context;
    },
  };
}

export type StatusDetailRuntimePort = ReturnType<typeof createStatusDetailRuntimePort>;
