import { currentMockScenario } from "@/platform/mock/scenario.js";
import { assertKnownStageOverrides } from "./job-payload-contract.js";
import {
  buildLiveMockJobPayload,
  registerLiveMockJob,
} from "@/platform/mock/live-jobs.js";
import {
  bindMockDocumentActiveJob,
  getMockDocumentByJobId,
} from "@/platform/mock/documents.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function recordOf(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export async function fetchJobDiagnostics(jobId, apiPrefix) {
  void apiPrefix;
  // 与 mock/job.js 的 failure 字段保持同源,避免详情弹窗(读 job.failure)
  // 与 detail 页(读本端点)在 mock 下显示不一致
  if (currentMockScenario() !== "failed") {
    return null;
  }
  return {
    job_id: jobId,
    summary: "任务失败，但这是前端 mock 场景。",
    category: "mock_render_failure",
    failed_stage: "render",
    root_cause: "用于 UI 调试的模拟失败。",
    suggestion: "切换 ?mock=succeeded 查看成功态。",
    detail: "",
    retryable: true,
    resume_available: true,
  };
}

export async function fetchResumePlan(jobId, apiPrefix) {
  void apiPrefix;
  return {
    job_id: jobId,
    can_resume: true,
    from_stage: "render",
    resume_workflow: "render",
    reuses_artifacts: ["translations_dir", "source_pdf"],
    reruns_stages: ["render"],
    reason: "mock resume plan",
  };
}

export async function resumeJob(jobId, apiPrefix) {
  void jobId;
  void apiPrefix;
  return {
    job_id: `mock-resume-${Date.now()}`,
    status: "queued",
  };
}

export async function cancelJob(jobId, apiPrefix) {
  void apiPrefix;
  return { job_id: jobId, status: "canceled" };
}

export async function cancelOcrJob(jobId, apiPrefix) {
  void apiPrefix;
  return { job_id: jobId, status: "canceled", workflow: "ocr" };
}

export async function resolveOcrAmbiguity(jobId, apiPrefix, request) {
  void apiPrefix;
  const live = registerLiveMockJob({ title: "Mock OCR 恢复", pageCount: 12 });
  const snapshot = buildLiveMockJobPayload(live.jobId) || {};
  return {
    resolution: request?.resolution || "accept_duplicate_risk",
    provider: "paddle",
    operation: "submit_local_file",
    submission: {
      ...snapshot,
      job_id: live.jobId,
      source_job_id: jobId,
      workflow: "ocr",
      rerun_from_stage: "ocr",
    },
  };
}

export async function fetchJobStageActions(jobId, apiPrefix) {
  void apiPrefix;
  return {
    job_id: jobId,
    stages: [
      { stage: "ocr", label: "重新 OCR", can_retry: true, disabled_reason: "" },
      { stage: "translation", label: "重新翻译", can_retry: true, disabled_reason: "" },
      { stage: "render", label: "重新渲染", can_retry: true, disabled_reason: "" },
    ],
  };
}

export async function retryJobStage(jobId, apiPrefix, stage, payload = {}) {
  void apiPrefix;
  const normalizedStage = `${stage || ""}`.trim();
  if (!normalizedStage) {
    throw new Error("阶段重试失败: 缺少 stage");
  }
  // 后端对 overrides 的每个段做 serde_json::from_value,同样带 deny_unknown_fields
  // (stage_retry_overrides.rs)。mock 以前完全无视 overrides,于是「重新翻译」那条
  // 注入逻辑在 mock 下从未被执行过。
  assertKnownStageOverrides((payload as Record<string, unknown>)?.overrides, {
    label: `retry-stage/${normalizedStage}`,
  });
  // 从指定阶段起跑；务必绑回原 document，否则书架会多一张「job_id 空壳卡」
  const bookMeta = recordOf(payload);
  // snapshot 常缺 document_id：用源 job → 文档表反查
  const linkedDoc = getMockDocumentByJobId(jobId);
  const documentId = `${bookMeta.document_id || linkedDoc?.document_id || ""}`.trim();
  const bookTitle = `${bookMeta.title || bookMeta.display_name || linkedDoc?.title || ""}`.trim();
  const live = registerLiveMockJob({
    jobId: `mock-${normalizedStage}-retry-${Date.now()}`,
    documentId: documentId || undefined,
    title: bookTitle || undefined,
    pageCount: Number(bookMeta.page_count || linkedDoc?.page_count) || undefined,
    fromStage: normalizedStage,
  });
  const docBound = documentId
    ? bindMockDocumentActiveJob(documentId, live.jobId, { previousJobId: jobId })
    : null;
  const snapshot = recordOf(buildLiveMockJobPayload(live.jobId));
  return {
    job_id: live.jobId,
    source_job_id: jobId,
    document_id: documentId || snapshot.document_id,
    title: bookTitle || docBound?.title || snapshot.title,
    display_name: bookTitle || docBound?.title || snapshot.display_name,
    cover_url: bookMeta.cover_url || linkedDoc?.cover_url || docBound?.cover_url,
    thumbnail_url: bookMeta.thumbnail_url || linkedDoc?.thumbnail_url || docBound?.thumbnail_url,
    page_count: bookMeta.page_count ?? linkedDoc?.page_count ?? docBound?.page_count ?? snapshot.page_count,
    status: snapshot.status || "running",
    stage: snapshot.stage || normalizedStage,
    display_stage: snapshot.display_stage,
    stage_detail: snapshot.stage_detail,
    progress: snapshot.progress,
    runtime: snapshot.runtime,
    timestamps: snapshot.timestamps,
    library_only: false,
    active_job_id: live.jobId,
    workflow: normalizedStage === "render" ? "render" : "book",
    rerun_from_stage: normalizedStage,
  };
}

export async function rerunJob(actionUrl) {
  void actionUrl;
  return {
    job_id: `mock-rerun-${Date.now()}`,
    status: "queued",
  };
}
