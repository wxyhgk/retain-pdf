// mock 文档的“API 行为”层：列表查询、删除保护、翻译/OCR 提交、名下 job 列表。
// 依赖 document-seed / collections / favorites / live-jobs，但自身不再持有状态。

import {
  MOCK_HISTORICAL_JOB_TO_DOCUMENT,
  documents,
  withMockDocumentMediaUrls,
} from "./document-seed.js";
import { collectionMembership, removeDocumentFromAllCollections } from "./collections.js";
import {
  buildLiveMockJobPayload,
  isLiveMockJobActive,
  registerLiveMockJob,
} from "./live-jobs.js";
import { matchesAnyText, nowIso, trimId } from "./mock-utils.js";
import type {
  MockDocumentListQuery,
  MockDocumentListResult,
} from "./documents.types.js";
import type { JobSubmissionView } from "@/platform/contracts/library-payloads.js";

type HttpStatusError = Error & {
  status?: number;
  favoriteCount?: number;
  clearFavoritesPath?: string;
  favoriteScope?: "document" | "job";
};

export function getMockDocumentList({
  limit = 50,
  offset = 0,
  readingStatus = "",
  tag = "",
  collectionId = "",
  q = "",
}: MockDocumentListQuery = {}): MockDocumentListResult {
  let list = documents();
  if (`${readingStatus}`.trim()) {
    list = list.filter((item) => item.reading_status === trimId(readingStatus));
  }
  if (`${tag}`.trim()) {
  }
  if (`${collectionId}`.trim()) {
    const memberIds = collectionMembership(trimId(collectionId));
    list = list.filter((item) => memberIds.has(item.document_id));
  }
  if (`${q}`.trim()) {
    const needle = trimId(q).toLowerCase();
    list = list.filter((item) => matchesAnyText([item.title, item.source_filename], needle));
  }
  return {
    documents: list.slice(offset, offset + limit).map(withMockDocumentMediaUrls),
    total: list.length,
    limit,
    offset,
  };
}

// mock 版 DELETE /documents/:id:从 mock 文档表移除该文档(连同其合集成员关系)。
// 被收藏引用时抛 409(镜像后端收藏保护)。
export function deleteMockDocument(documentId: string): {
  deleted: boolean;
  document_id: string;
  removed_paths: string[];
} {
  const list = documents();
  const index = list.findIndex((item) => item.document_id === documentId);
  if (index < 0) {
    throw new Error("未找到该文档。(404)");
  }

  list.splice(index, 1);
  removeDocumentFromAllCollections(documentId);
  return { deleted: true, document_id: documentId, removed_paths: [] };
}

// mock 版 POST /documents/:id/translate：登记 live 可推进任务，
// 轮询 getMockJobPayload 会随时间走 OCR→翻译→渲染→完成（见 mock/live-jobs）。
// 运行中再次提交 → 409；已终态可重新提交（方便反复演示）。
export function translateMockDocument(documentId: string): JobSubmissionView {
  const found = documents().find((item) => item.document_id === documentId);
  if (!found) {
    throw new Error("未找到该文档。(404)");
  }
  const existingId = trimId(found.active_job_id);
  if (existingId && isLiveMockJobActive(existingId)) {
    throw new Error("该文档已在翻译流程中。(409)");
  }
  const live = registerLiveMockJob({
    documentId: found.document_id,
    title: found.title,
    pageCount: found.page_count,
  });
  found.active_job_id = live.jobId;
  found.updated_at = nowIso();
  const snapshot = buildLiveMockJobPayload(live.jobId) || {};
  return {
    job_id: live.jobId,
    document_id: found.document_id,
    workflow: "book",
    status: `${snapshot.status || "queued"}`,
    stage: `${snapshot.stage || "queued"}`,
    display_stage: `${snapshot.display_stage || "ocr"}`,
    stage_detail: `${snapshot.stage_detail || "正在读取任务状态..."}`,
  };
}

export function ocrMockDocument(documentId: string): JobSubmissionView {
  const found = documents().find((item) => item.document_id === documentId);
  if (!found) {
    throw new Error("未找到该文档。(404)");
  }
  const previous = trimId(found.active_job_id);
  const jobId = `mock-ocr-${Date.now()}`;
  if (previous) MOCK_HISTORICAL_JOB_TO_DOCUMENT[previous] = found.document_id;
  MOCK_HISTORICAL_JOB_TO_DOCUMENT[jobId] = found.document_id;
  found.active_job_id = jobId;
  found.updated_at = nowIso();
  return {
    job_id: jobId,
    document_id: found.document_id,
    workflow: "ocr",
    status: "queued",
    stage: "queued",
    display_stage: "ocr",
  };
}

export function getMockDocumentJobs(documentId: string) {
  const found = documents().find((item) => item.document_id === documentId);
  if (!found) {
    throw new Error("未找到该文档。(404)");
  }
  const jobId = trimId(found.active_job_id);
  if (!jobId) return { items: [], invocation_summary: {} };
  const isOcr = jobId.startsWith("mock-ocr-");
  const live = isOcr ? null : buildLiveMockJobPayload(jobId);
  const status = `${live?.status || (isOcr ? "queued" : "succeeded")}`;
  const stage = `${live?.stage || (isOcr ? "queued" : "finished")}`;
  const displayStage = `${live?.display_stage || (isOcr ? "ocr" : "done")}`;
  const stageDetail = `${live?.stage_detail || (isOcr ? "OCR 任务已排队" : "任务完成")}`;
  const liveProgress: { current?: unknown; total?: unknown; percent?: unknown } = live?.progress || {};
  return {
    items: [{
      job_id: jobId,
      workflow: isOcr ? "ocr" : "book",
      status,
      stage_snapshot: {
        display_stage: displayStage,
        stage,
        stage_detail: stageDetail,
        progress: isOcr
          ? { current: 0, total: found.page_count }
          : {
              current: Number(liveProgress.current) || found.page_count,
              total: Number(liveProgress.total) || found.page_count,
              percent: Number(liveProgress.percent),
            },
      },
      created_at: found.updated_at,
      updated_at: found.updated_at,
      markdown_ready: !isOcr && status === "succeeded",
      output_pdf_ready: !isOcr && status === "succeeded",
    }],
    invocation_summary: {},
  };
}
