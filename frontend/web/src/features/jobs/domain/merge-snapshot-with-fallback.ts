// statusCard 快照 + 书架 live item 合并。
//
// 问题：attachJobProgress → startPolling 首帧会推 placeholder
// （status=queued, stage_detail=正在读取…），已完成书会被盖成排队。
// 本函数把书架 item 的终态/进度补回 snapshot，详情与主流程共用一处。

import type { StatusCardJobRecord, StatusCardSnapshot } from "./status-card-store.js";
import { isPollingBootstrapPlaceholder } from "./polling-placeholder.js";

// 保持向后兼容：旧路径仍可 import isPollingBootstrapPlaceholder（迁移期）
export { isPollingBootstrapPlaceholder } from "./polling-placeholder.js";

/** 书架 live 行（library item）上与进度合并相关的字段 */
export type StatusCardFallbackItem = {
  job_id?: string;
  status?: string;
  stage_detail?: string;
  detail?: string;
  output_pdf_ready?: boolean;
  created_at?: string;
  updated_at?: string;
  progress?: {
    percent?: number;
    current?: number;
    total?: number;
    unit?: string;
  } | null;
  stage_snapshot?: {
    display_stage?: string;
    stage_detail?: string;
    progress?: {
      percent?: number;
      current?: number;
      total?: number;
      unit?: string;
    } | null;
  } | null;
  [key: string]: unknown;
};

/**
 * @param snapshot statusCardStore.snapshot
 * @param fallbackItem 书架 item
 */
export function mergeSnapshotWithFallback(
  snapshot: StatusCardSnapshot | null | undefined,
  fallbackItem: StatusCardFallbackItem | null = null,
): StatusCardSnapshot | null | undefined {
  if (!fallbackItem || typeof fallbackItem !== "object") {
    return snapshot;
  }
  const snapJob = `${snapshot?.jobId || ""}`.trim();
  const itemJob = `${fallbackItem.job_id || ""}`.trim().replace(/^doc:/, "");
  if (!itemJob) {
    return snapshot;
  }
  const snapshotMatches = !snapJob || snapJob === itemJob || snapJob.startsWith("doc:");

  const itemStatus = `${fallbackItem.status || ""}`.trim().toLowerCase();
  const isolatedSnapshot = snapshotMatches ? snapshot : {
    ...snapshot!,
    jobId: itemJob,
    status: itemStatus,
    label: itemStatus === "failed" ? "失败" : itemStatus === "succeeded" ? "完成" : "等待中",
    value: itemStatus === "failed" ? "任务失败" : "准备中",
    detail: "",
    stageKey: "",
    visualStageKey: "",
    substageKey: "",
    displayPercent: null,
    progressPercent: Number.NaN,
    progressCurrent: Number.NaN,
    progressTotal: Number.NaN,
    progressFallbackText: "",
    progressText: "",
    progressUnit: "",
    progressIndeterminate: false,
    stageProgressByKey: {},
    stageRetryActions: {},
    pdfReady: false,
    pdfUrl: "",
    markdownBundleReady: false,
    markdownBundleUrl: "",
    readerReady: false,
    readerUrl: "",
    sourcePdfReady: false,
    sourcePdfUrl: "",
    cancelEnabled: false,
    backgroundStages: [],
    job: { job_id: itemJob, status: itemStatus },
    summary: null,
    stagePresentation: null,
  } as StatusCardSnapshot;
  const snapStatus = `${snapshot?.status || ""}`.trim().toLowerCase();
  const snapIsWeak =
    !snapStatus
    || snapStatus === "queued"
    || !snapJob
    || !snapshotMatches
    || `${snapshot?.detail || ""}`.includes("正在读取")
    || `${snapshot?.value || ""}`.includes("准备");

  const stageSnapshot = fallbackItem.stage_snapshot && typeof fallbackItem.stage_snapshot === "object"
    ? fallbackItem.stage_snapshot
    : {};
  const progress = stageSnapshot.progress && typeof stageSnapshot.progress === "object"
    ? stageSnapshot.progress
    : fallbackItem.progress && typeof fallbackItem.progress === "object"
      ? fallbackItem.progress
      : {};
  const fallbackDetail = `${stageSnapshot.stage_detail || fallbackItem.stage_detail || ""}`.trim();
  const fallbackStage = `${stageSnapshot.display_stage || ""}`.trim();
  const itemPercent = Number(progress.percent);
  const itemCurrent = Number(progress.current);
  const itemTotal = Number(progress.total);

  if (itemStatus === "succeeded" && (snapIsWeak || snapStatus !== "succeeded")) {
    const snapJobRecord = isolatedSnapshot?.job as StatusCardJobRecord | null | undefined;
    const jobMatches = snapJobRecord
      && `${snapJobRecord.job_id || isolatedSnapshot?.jobId || ""}`.trim() === itemJob;
    const succeededJob: StatusCardJobRecord = jobMatches && snapJobRecord
      ? snapJobRecord
      : {
          job_id: itemJob,
          status: "succeeded",
          stage: "finished",
          stage_detail: fallbackDetail || "任务完成",
          progress: {
            percent: 100,
            current: itemCurrent || 100,
            total: itemTotal || 100,
            unit: "percent",
          },
          timestamps: {
            started_at: (fallbackItem.created_at as string) || "",
            finished_at: (fallbackItem.updated_at as string) || "",
          },
        };
    return {
      ...isolatedSnapshot!,
      jobId: itemJob,
      status: "succeeded",
      stageKey: "done",
      label: "完成",
      value: "翻译 PDF 已生成",
      detail: fallbackDetail || "任务完成",
      displayPercent: 100,
      progressPercent: 100,
      progressCurrent: Number.isFinite(itemCurrent) ? itemCurrent : 100,
      progressTotal: Number.isFinite(itemTotal) && itemTotal > 0 ? itemTotal : 100,
      progressFallbackText: "完成",
      progressText: "渲染完成",
      progressUnit: "percent",
      progressIndeterminate: false,
      visualStageKey: "done",
      stageProgressByKey: {},
      stageRetryActions: {},
      cancelEnabled: false,
      readerReady: true,
      pdfReady: Boolean(fallbackItem.output_pdf_ready ?? true),
      job: succeededJob,
    };
  }

  if (itemStatus === "failed" && snapIsWeak) {
    const failedJob: StatusCardJobRecord = {
      job_id: itemJob,
      status: "failed",
      stage: fallbackStage || "failed",
      stage_detail: fallbackDetail || "任务失败",
      progress: { percent: 0, current: 0, total: 0 },
      timestamps: {
        started_at: (fallbackItem.created_at as string) || "",
        finished_at: (fallbackItem.updated_at as string) || "",
      },
    };
    return {
      ...isolatedSnapshot!,
      jobId: itemJob,
      status: "failed",
      label: "失败",
      value: "任务失败",
      detail: fallbackDetail,
      stageKey: fallbackStage,
      visualStageKey: fallbackStage,
      displayPercent: 0,
      progressPercent: 0,
      progressCurrent: 0,
      progressTotal: 0,
      progressFallbackText: "",
      progressText: "",
      progressUnit: "",
      progressIndeterminate: false,
      stageProgressByKey: {},
      stageRetryActions: {},
      pdfReady: false,
      pdfUrl: "",
      markdownBundleReady: false,
      markdownBundleUrl: "",
      readerReady: false,
      readerUrl: "",
      cancelEnabled: false,
      job: failedJob,
      summary: null,
    };
  }

  if (["running", "queued", "pending", "validating"].includes(itemStatus) && snapIsWeak) {
    return {
      ...isolatedSnapshot!,
      jobId: itemJob,
      status: itemStatus,
      stageKey: fallbackStage || isolatedSnapshot?.stageKey || "ocr",
      label: isolatedSnapshot?.label || (itemStatus === "queued" ? "排队中" : "处理中"),
      detail: fallbackDetail || `${isolatedSnapshot?.detail || ""}`.trim(),
      displayPercent: Number.isFinite(itemPercent) ? itemPercent : isolatedSnapshot?.displayPercent ?? null,
      progressPercent: Number.isFinite(itemPercent) ? itemPercent : (isolatedSnapshot?.progressPercent ?? NaN),
      progressCurrent: Number.isFinite(itemCurrent) ? itemCurrent : (isolatedSnapshot?.progressCurrent ?? NaN),
      progressTotal: Number.isFinite(itemTotal) ? itemTotal : (isolatedSnapshot?.progressTotal ?? NaN),
      // 文档列表投影通常不携带 actions.cancel.url，但标准取消路由始终由
      // job_id 构造。活跃 fallback 不能沿用隔离快照里的 false，否则详情页
      // 会把真实运行中的任务错误显示为不可取消。
      cancelEnabled: true,
    };
  }

  return isolatedSnapshot;
}
