import {
  createSecondaryResourceStatePort,
  createCurrentJobStatePort,
  createJobRenderContextPort,
} from "../../composition/external.js";
import type {
  JobLike,
  JobPayload,
  EventsPayload,
} from "../../composition/external.js";

// runtimePort của StatusDetailDialog (bản thiết kế §1 nguyên tắc nguồn dữ liệu: đọc state
// giữ từ job-runtime, không phải statusCardStore).
//
// Logic sao chép từ src/js/bootstrap/status-detail-runtime-port.js — đường dẫn file đó
// trúng regex chống hồi quy `/bootstrap/` của architecture-boundaries.test.mjs, pages/**
// cấm import; nhưng bản thân nó chỉ là tổ hợp literal của ba cổng kept của job-runtime
// (current-job-state.js/secondary-resource-cache.js/render-context.js), không có logic
// DOM, chép nguyên trạng không rủi ro. composition.js dùng cùng đối tượng jobRuntimeState
// để cấu tạo, lấy cùng tham chiếu currentJobStore/secondaryResourceStore với engine
// job-runtime, không tạo trạng thái song song.

/** Tham số applyOverviewPayload: lô tải trọng ghi ngược vào runtime sau khi làm mới tổng quan */
export interface StatusDetailOverviewPayloadOptions {
  payload?: JobLike | JobPayload | Record<string, unknown> | null;
  eventsPayload?: EventsPayload | null;
  diagnosticsPayload?: unknown;
  resumePlan?: unknown;
  fallbackJobId?: string;
}

export function createStatusDetailRuntimePort(state: object) {
  const currentJobPort = createCurrentJobStatePort(state);
  const secondaryResourcePort = createSecondaryResourceStatePort(state);
  const renderContextPort = createJobRenderContextPort(state);

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
    currentResumePlan() {
      return currentJobPort.resumePlan();
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
      fallbackJobId = "",
    }: StatusDetailOverviewPayloadOptions = {}) {
      const context = renderContextPort.applySnapshot({
        payload: {
          ...(payload || {}),
          job_id: payload?.job_id || fallbackJobId,
        },
        eventsPayload,
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
