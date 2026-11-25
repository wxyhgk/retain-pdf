// documents — pure
import { refusedSubmissionError } from "./http.js";
import * as generated from "./generated/library-documents.js";
import { failWith, failWithServerMessage } from "./request.js";
import { newIdempotencyKey } from "./idempotency.js";

import type {
  ApplyDocumentMetadataSuggestionInput,
  CoverageJobView,
  CoverageSegment,
  CreateDocumentMetadataSuggestionInput,
  CreateJobInput,
  DocumentDeleteResultView,
  DocumentListView,
  DocumentMetadataEvidenceView,
  DocumentMetadataSuggestionApplyView,
  DocumentMetadataSuggestionListView,
  DocumentMetadataSuggestionView,
  DocumentReadingView,
  DocumentRecord,
  DocumentTitleCandidateView,
  PatchDocumentInput,
  PatchTranslationVersionInput,
  TranslationCoverageView,
  TranslationVersionView,
  TranslationVersionsView,
} from "@retainpdf/contracts/library-documents";

// 书库的线上形状以契约 library-documents.v1 为准；下面是沿用的旧名字。
export type {
  ApplyDocumentMetadataSuggestionInput,
  CreateDocumentMetadataSuggestionInput,
  DocumentDeleteResultView,
  DocumentListView,
  DocumentReadingView,
  DocumentRecord,
  TranslationCoverageView,
  PatchTranslationVersionInput,
  TranslationVersionView,
  TranslationVersionsView,
};
/** 阅读状态只有这三种，PATCH 时写别的后端回 400。 */
export type DocumentReadingStatus = NonNullable<PatchDocumentInput["reading_status"]>;
export type DocumentMetadataEvidence = DocumentMetadataEvidenceView;
export type DocumentTitleCandidate = DocumentTitleCandidateView;
export type DocumentMetadataSuggestion = DocumentMetadataSuggestionView;
export type TranslationCoverageSegment = CoverageSegment;
export type TranslationCoverageJob = CoverageJobView;

export type DocumentListQuery = {
  limit?: number;
  offset?: number;
  readingStatus?: string;
  collectionId?: string;
  /** 服务端标题/原始文件名包含匹配（后端 LIKE，已转义 %/_）。空串不发送。 */
  q?: string;
};

// 书籍详情用的这几个任务类型比契约宽（带索引签名、字段都可选），和契约的 JobListItemView、JobSubmissionView
// 互相赋不过去。接口返回在 translateDocument、ocrDocument、fetchDocumentJobs 里转成它们；书籍详情改用契约类型以后删掉。
export type DocumentJobSummary = Record<string, any> & {
  job_id?: string;
  workflow?: string;
  status?: string;
  ocr_reused?: boolean;
  source_artifact_job_id?: string | null;
  stages?: DocumentJobStages;
};

export type DocumentJobStageState =
  | "reused"
  | "queued"
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped";

export type DocumentJobStages = {
  ocr?: { state?: DocumentJobStageState; [key: string]: unknown };
  translation?: { state?: DocumentJobStageState; [key: string]: unknown };
  render?: { state?: DocumentJobStageState; [key: string]: unknown };
  [key: string]: unknown;
};

export type DocumentJobSubmissionView = {
  job_id: string;
  workflow: string;
  status: string;
  ocr_reused: boolean;
  source_artifact_job_id?: string | null;
  stages?: DocumentJobStages;
  [key: string]: unknown;
};

export type DocumentJobsView = {
  items: DocumentJobSummary[];
  invocation_summary?: Record<string, unknown>;
  total?: number;
  limit?: number;
  offset?: number;
  has_more?: boolean;
};

export type DocumentJobsQuery = {
  limit?: number;
  offset?: number;
};

export interface DocumentRequestError extends Error {
  status?: number;
  errorCode?: string;
  reason?: string;
  canFallbackToOcr?: boolean;
}

function documentRequestError(
  fallback: string,
  status: number,
  payload: any,
): DocumentRequestError {
  // 通用错误把结构化数据放在 payload.error.details；老接口可能直接在 payload.details/data。
  const structured = payload?.error && typeof payload.error === "object" ? payload.error : null;
  const details = structured?.details && typeof structured.details === "object"
    ? structured.details
    : payload?.details && typeof payload.details === "object"
      ? payload.details
      : payload?.data && typeof payload.data === "object"
        ? payload.data
        : {};
  const message = `${payload?.message || details?.message || fallback}`;
  const error = new Error(`${message}(${status})`) as DocumentRequestError;
  error.status = status;
  const errorCode = `${payload?.error_code || structured?.code || details?.error_code || details?.code || (typeof payload?.code === "string" ? payload.code : "")}`.trim();
  if (errorCode) error.errorCode = errorCode;
  const reason = `${payload?.reason || details?.reason || ""}`.trim();
  if (reason) error.reason = reason;
  const canFallback = payload?.can_fallback_to_ocr ?? details?.can_fallback_to_ocr;
  if (typeof canFallback === "boolean") error.canFallbackToOcr = canFallback;
  return error;
}

// 下面这些走生成的请求函数（契约 library-documents.v1 的端点表），这里只管参数整理和给用户看的报错。

function trimmed(value: unknown): string | undefined {
  const text = `${value ?? ""}`.trim();
  return text || undefined;
}

function requireId(value: string, name: string): string {
  const normalized = `${value || ""}`.trim();
  if (!normalized) throw new Error(`缺少 ${name}。`);
  return normalized;
}

function documentError(fallback: string) {
  return (status: number, payload: any) => documentRequestError(fallback, status, payload);
}

export async function fetchDocumentList(
  apiPrefix: string,
  { limit = 50, offset = 0, readingStatus = "", collectionId = "", q = "" }: DocumentListQuery = {},
): Promise<DocumentListView> {
  return generated.listDocuments(
    apiPrefix,
    { query: { limit, offset, reading_status: trimmed(readingStatus), collection_id: trimmed(collectionId), q: trimmed(q) } },
    { onError: failWith("读取文档库失败，请稍后重试。") },
  );
}

export async function fetchDocumentByJobId(apiPrefix: string, jobId: string): Promise<DocumentRecord | null> {
  const normalized = trimmed(jobId);
  if (!normalized) return null;
  const payload = await generated.listDocuments(
    apiPrefix,
    { query: { job_id: normalized } },
    { onError: failWith("按 job 查文档失败，请稍后重试。") },
  );
  const documents = payload?.documents;
  return Array.isArray(documents) && documents.length ? documents[0] : null;
}

export async function fetchDocument(apiPrefix: string, documentId: string): Promise<DocumentRecord> {
  return generated.getDocument(
    apiPrefix,
    { document_id: requireId(documentId, "document_id") },
    { onError: failWith("读取文档详情失败，请稍后重试。") },
  );
}

export async function patchDocument(apiPrefix: string, documentId: string, payload: PatchDocumentInput = {}): Promise<DocumentRecord> {
  return generated.patchDocument(
    apiPrefix,
    { document_id: requireId(documentId, "document_id"), body: payload },
    { onError: failWithServerMessage("更新文档失败，请稍后重试。") },
  );
}

/** GET /documents/:id/reading —— 阅读器该打开哪个任务。给了 version 就是那个译文版本的（阅读页「对比版本」用）。 */
export async function fetchDocumentReading(
  apiPrefix: string,
  documentId: string,
  { version = "" }: { version?: string } = {},
): Promise<DocumentReadingView> {
  return generated.getDocumentReading(
    apiPrefix,
    { document_id: requireId(documentId, "document_id"), query: version ? { version } : {} },
    { onError: failWith("读取阅读入口失败。") },
  );
}

/** GET /documents/:id/translation-versions —— 一本书的几份译文和当前选的哪份（null = 自动，逐页取最新）。 */
export async function fetchTranslationVersions(
  apiPrefix: string,
  documentId: string,
  { includeHidden = false }: { includeHidden?: boolean } = {},
): Promise<TranslationVersionsView> {
  return generated.listTranslationVersions(
    apiPrefix,
    { document_id: requireId(documentId, "document_id"), query: includeHidden ? { include_hidden: true } : {} },
    { onError: failWith("读取译文版本失败。") },
  );
}

/** PUT /documents/:id/translation-version —— 换当前版本；null 回到自动。隐藏的版本 409，带后端的原因。 */
export async function setCurrentTranslationVersion(
  apiPrefix: string,
  documentId: string,
  versionId: string | null,
): Promise<TranslationVersionsView> {
  return generated.setCurrentTranslationVersion(
    apiPrefix,
    { document_id: requireId(documentId, "document_id"), body: { version_id: versionId } },
    { onError: failWithServerMessage("切换译文版本失败，请稍后重试。") },
  );
}

/** PATCH /documents/:id/translation-versions/:version_id —— 改名（空串清掉）、隐藏或恢复。 */
export async function patchTranslationVersion(
  apiPrefix: string,
  documentId: string,
  versionId: string,
  payload: PatchTranslationVersionInput,
): Promise<TranslationVersionsView> {
  return generated.patchTranslationVersion(
    apiPrefix,
    { document_id: requireId(documentId, "document_id"), version_id: requireId(versionId, "version_id"), body: payload },
    { onError: failWithServerMessage("修改译文版本失败，请稍后重试。") },
  );
}

/** GET /documents/:id/translation-coverage —— 一本书翻了哪些页、每次任务提供了几页。 */
export async function fetchDocumentTranslationCoverage(
  apiPrefix: string,
  documentId: string,
): Promise<TranslationCoverageView> {
  return generated.getTranslationCoverage(
    apiPrefix,
    { document_id: requireId(documentId, "document_id") },
    { onError: failWith("读取翻译覆盖失败。") },
  );
}

export async function createDocumentMetadataSuggestion(
  apiPrefix: string,
  documentId: string,
  payload: CreateDocumentMetadataSuggestionInput = {},
): Promise<DocumentMetadataSuggestion> {
  return generated.createMetadataSuggestion(
    apiPrefix,
    { document_id: requireId(documentId, "document_id"), body: payload },
    { onError: documentError("生成文档元数据建议失败。") },
  );
}

export async function fetchDocumentMetadataSuggestions(
  apiPrefix: string,
  documentId: string,
  { limit = 20 }: { limit?: number } = {},
): Promise<DocumentMetadataSuggestion[]> {
  const normalized = trimmed(documentId);
  if (!normalized) return [];
  const payload = await generated.listMetadataSuggestions(
    apiPrefix,
    { document_id: normalized, query: { limit } },
    { onError: documentError("读取文档元数据建议失败。") },
  );
  return Array.isArray(payload?.suggestions) ? payload.suggestions : [];
}

export async function applyDocumentMetadataSuggestion(
  apiPrefix: string,
  documentId: string,
  suggestionId: string,
  payload: ApplyDocumentMetadataSuggestionInput = {},
): Promise<DocumentMetadataSuggestionApplyView> {
  const document_id = requireId(documentId, "document_id");
  const suggestion_id = requireId(suggestionId, "suggestion_id");
  return generated.applyMetadataSuggestion(
    apiPrefix,
    { document_id, suggestion_id, body: payload },
    { onError: documentError("应用文档元数据建议失败。") },
  );
}

export async function deleteDocument(apiPrefix: string, documentId: string, { force = false }: { force?: boolean } = {}): Promise<DocumentDeleteResultView> {
  // 保留 HTTP 状态：409 是文档下还有排队或运行中的任务（force=true 才删）
  return generated.deleteDocument(
    apiPrefix,
    { document_id: requireId(documentId, "document_id"), query: { force: force || undefined } },
    { onError: documentError("删除文档失败，请稍后重试。") },
  );
}

export async function translateDocument(
  apiPrefix: string,
  documentId: string,
  payload: Record<string, unknown> = {},
): Promise<DocumentJobSubmissionView> {
  // 页数额度不够、磁盘空间不够给一句中文（refusedSubmissionError）；复用 OCR 出错时的 reason、can_fallback_to_ocr 由 documentRequestError 挂上。
  return generated.translateDocument(
    apiPrefix,
    { document_id: requireId(documentId, "document_id"), body: payload as unknown as CreateJobInput },
    { idempotencyKey: newIdempotencyKey(), onError: (status, envelope) => refusedSubmissionError(status, envelope) ?? documentRequestError("发起翻译失败，请稍后重试。", status, envelope) },
  ) as unknown as Promise<DocumentJobSubmissionView>;
}

export async function ocrDocument(
  apiPrefix: string,
  documentId: string,
  payload: Record<string, unknown> = {},
): Promise<any> {
  return generated.ocrDocument(
    apiPrefix,
    { document_id: requireId(documentId, "document_id"), body: payload as unknown as CreateJobInput },
    { idempotencyKey: newIdempotencyKey(), onError: (status, envelope) => refusedSubmissionError(status, envelope) ?? failWithServerMessage("发起 OCR 失败，请稍后重试。")(status, envelope) },
  );
}

export async function submitDocument(
  apiPrefix: string,
  documentId: string,
  payload: Record<string, unknown> = {},
): Promise<DocumentJobSubmissionView> {
  const workflow = `${(payload as Record<string, unknown>)?.workflow || ""}`.trim().toLowerCase();
  if (workflow === "ocr") {
    return ocrDocument(apiPrefix, documentId, payload);
  }
  return translateDocument(apiPrefix, documentId, payload);
}

export async function fetchDocumentJobs(
  apiPrefix: string,
  documentId: string,
  { limit = 50, offset = 0 }: DocumentJobsQuery = {},
): Promise<DocumentJobsView> {
  const normalized = trimmed(documentId);
  if (!normalized) return { items: [] };
  const payload = await generated.listDocumentJobs(
    apiPrefix,
    { document_id: normalized, query: { limit, offset } },
    { onError: failWith("读取文档任务失败，请稍后重试。") },
  ) as unknown as DocumentJobsView;
  return {
    ...payload,
    items: Array.isArray(payload?.items) ? payload.items : [],
  };
}
