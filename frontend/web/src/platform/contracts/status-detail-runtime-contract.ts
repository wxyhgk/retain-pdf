// job-detail ⇄ jobs 的中性依赖契约。
//
// StatusDetailDialog 的 runtimePort 需要 job-runtime 三个 kept 端口
// (current-job-state / secondary-resource-cache / render-context)，但 job-detail
// 不得值依赖 features/jobs（否则 jobs ⇄ job-detail 成环）。这里只声明 job-detail
// 侧实际消费到的最小结构，真正的实现由组合层
// (app/home/composition/create-status-domain.ts) 从 features/jobs 构造后注入。

import type { JobLike, JobPayload } from "@retainpdf/domain/job";
import type { EventsPayload } from "@retainpdf/domain/job-status";

/** overview 载荷里允许出现的主任务快照形态。 */
export type StatusDetailJobSnapshot =
  | JobLike
  | JobPayload
  | Record<string, unknown>
  | null;

/** job-runtime current-job-state 端口在 job-detail 侧用到的面。 */
export interface StatusDetailCurrentJobPort {
  jobId(): string;
  snapshot(): StatusDetailJobSnapshot;
  finishedAt(): string;
  resumePlan(): unknown;
  getSnapshot(): { startedAt?: string; finishedAt?: string };
  cacheDiagnostics(jobId: unknown, payload: unknown): unknown;
  cacheResumePlan(jobId: unknown, payload: unknown): unknown;
  syncSnapshot(
    job: StatusDetailJobSnapshot,
    jobId: unknown,
    meta?: { startedAt?: unknown; finishedAt?: unknown },
  ): unknown;
}

/** job-runtime secondary-resource-cache 端口在 job-detail 侧用到的面。 */
export interface StatusDetailSecondaryResourcePort {
  cache(type: string, jobId: unknown, payload: unknown): unknown;
}

/** job-runtime render-context 端口的返回上下文。 */
export type StatusDetailRenderContext = {
  job: (JobLike & { diagnostics?: unknown })
    | (JobPayload & { diagnostics?: unknown })
    | Record<string, unknown>
    | null;
  jobId: string;
  events?: EventsPayload | null;
  manifest?: unknown;
  stageActions?: unknown;
};

/** job-runtime render-context 端口在 job-detail 侧用到的面。 */
export interface StatusDetailJobRenderContextPort {
  applySnapshot(args: {
    payload?: StatusDetailJobSnapshot;
    eventsPayload?: unknown;
    manifestPayload?: unknown;
    stageActionsPayload?: unknown;
  }): StatusDetailRenderContext;
  currentFor(jobId: string): StatusDetailRenderContext;
}

/** 组合层注入 createStatusDetailRuntimePort 的三个 kept 端口。 */
export interface StatusDetailRuntimePorts {
  currentJobPort: StatusDetailCurrentJobPort;
  secondaryResourcePort: StatusDetailSecondaryResourcePort;
  renderContextPort: StatusDetailJobRenderContextPort;
}

/** 任务详情弹窗的打开参数（job-detail 的 dialog store 与 ui 层 context 共用）。 */
export type StatusDetailDialogPayload = {
  activeTab: string;
};
