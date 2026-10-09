// 概览数据加载 + 快照落 store：组合 overview-coordinator（fetch 编排）与
// snapshot/failure-recovery/ocr 纯函数，把 render* 回调写成 store 写入。

import type { StatusDetailRuntimePort } from "../status-detail-runtime-port.js";
import type { StatusDetailStore } from "../status-detail-store.js";
import { buildStatusDetailSnapshot } from "../snapshot/snapshot.js";
import type { EventsPayload } from "@retainpdf/domain/job-status";
import {
  buildFailureRecoveryModel,
} from "./failure-recovery.js";
import {
  createStatusDetailOverviewCoordinator,
} from "./overview-coordinator.js";
import {
  readOcrAmbiguityView,
  requiresOcrAmbiguityResolution,
} from "../ocr-ambiguity-recovery.js";
import type {
  StatusDetailControllerDeps,
  StatusDetailOverviewRenderContext,
} from "./controller-types.js";

export function createStatusDetailOverviewActions({
  runtimePort,
  apiPrefix,
  fetchJobPayload,
  fetchJobEvents,
  fetchJobDiagnostics,
  fetchResumePlan,
  fetchJobStageActions,
  renderJob,
  store,
  setText,
  syncRerunAction,
}: {
  runtimePort: StatusDetailRuntimePort;
  apiPrefix?: string;
  fetchJobPayload?: StatusDetailControllerDeps["fetchJobPayload"];
  fetchJobEvents?: StatusDetailControllerDeps["fetchJobEvents"];
  fetchJobDiagnostics?: StatusDetailControllerDeps["fetchJobDiagnostics"];
  fetchResumePlan?: StatusDetailControllerDeps["fetchResumePlan"];
  fetchJobStageActions?: StatusDetailControllerDeps["fetchJobStageActions"];
  renderJob?: StatusDetailControllerDeps["renderJob"];
  store: StatusDetailStore;
  setText?: (id: string, message: string) => void;
  syncRerunAction: (statusText?: string) => unknown;
}) {
  // ---- overview(overview-coordinator.js 保留;renderOverviewSnapshot 落到
  //      store,job/eventsPayload 存原始值——蓝图 §1 判决表:history.js/
  //      events.js 的 markup 拼接部分不用,StageHistoryList/EventsList 从这
  //      两个原始字段用纯函数各自计算结构化数组) ----
  function renderOverviewSnapshot(context: StatusDetailOverviewRenderContext | null | undefined) {
    const job = context?.job || null;
    const eventsPayload = context?.events || null;
    if (!job) {
      return;
    }
    const finishedAtFallback = runtimePort.currentJobFinishedAt();
    const descriptor = readOcrAmbiguityView(job);
    const jobRecord = job as Record<string, unknown>;
    const jobId = `${jobRecord.job_id || context?.jobId || ""}`.trim();
    const previousAmbiguity = store.getSnapshot().overview.ocrAmbiguity;
    const sameResolution = previousAmbiguity.jobId === jobId
      && previousAmbiguity.descriptor?.resolution_revision === descriptor?.resolution_revision;
    const snapshot = buildStatusDetailSnapshot(job, eventsPayload, {
      durationOptions: { finishedAtFallback },
    });
    const jobWithDiagnostics = job as Record<string, unknown>;
    const failureRecovery = buildFailureRecoveryModel({
      job,
      diagnostics: jobWithDiagnostics.diagnostics,
      stageActions: context?.stageActions,
      resumePlan: runtimePort.currentResumePlan(),
      eventsPayload,
    });
    store.actions.setOverview({
      headline: snapshot.headline,
      runtime: snapshot.runtime,
      failure: snapshot.failure,
      rerun: snapshot.rerun,
      ocrAmbiguity: {
        required: requiresOcrAmbiguityResolution(job),
        status: sameResolution ? previousAmbiguity.status : "",
        jobId,
        descriptor,
      },
      failureRecovery,
      job: job as Record<string, unknown>,
      eventsPayload: eventsPayload as EventsPayload | null,
      finishedAtFallback,
    });
    syncRerunAction();
  }

  const overviewTab = createStatusDetailOverviewCoordinator({
    runtimePort,
    apiPrefix,
    fetchJobPayload,
    fetchJobEvents,
    fetchJobDiagnostics,
    fetchResumePlan,
    fetchJobStageActions,
    renderJob,
    renderOverviewSnapshot,
    setErrorText: (message: string) => setText?.("error-box", message),
  });

  async function ensureOverviewData({ force = false }: { force?: boolean } = {}) {
    await overviewTab.ensureLoaded({ force });
  }

  return { renderOverviewSnapshot, ensureOverviewData };
}
