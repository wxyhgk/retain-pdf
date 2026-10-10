// documents — pure
import { apiFetch } from "./internal/runtime.js";
import { buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint, pageQuotaErrorFromPayload } from "./http.js";

export type DocumentRecord = Record<string, any> & {
  document_id?: string;
  title?: string;
  title_source?: "filename" | "pdf_metadata" | "ocr" | "ai" | "user" | string;
  title_locked?: boolean;
  updated_at?: string;
};

export type DocumentMetadataEvidence = {
  source: string;
  page_idx?: number;
  block_id?: string;
  structure_role?: string;
  layout_role?: string;
};

export type DocumentTitleCandidate = {
  value: string;
  source: string;
  confidence: number;
  evidence: DocumentMetadataEvidence[];
};

export type DocumentMetadataSuggestion = {
  suggestion_id: string;
  document_id: string;
  source_job_id?: string;
  artifact_sha256: string;
  status: "completed" | "applied" | string;
  fields: string[];
  title_candidates: DocumentTitleCandidate[];
  selected_title: string;
  generation_method: string;
  needs_ai_review: boolean;
  applied: boolean;
  can_apply: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateDocumentMetadataSuggestionInput = {
  job_id?: string;
  fields?: Array<"title">;
  apply_if_default?: boolean;
};

export type ApplyDocumentMetadataSuggestionInput = {
  expected_document_updated_at?: string;
};
export type DocumentListQuery = {
  limit?: number;
  offset?: number;
  readingStatus?: string;
  tag?: string;
  collectionId?: string;
  /** 服务端标题/原始文件名包含匹配（后端 LIKE，已转义 %/_）。空串不发送。 */
  q?: string;
};

export type DocumentListView = {
  documents: DocumentRecord[];
  /** Total matches for the current filters; unaffected by limit/offset. */
  total: number;
  limit: number;
  offset: number;
};
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
  /** DELETE_BLOCKED_BY_FAVORITES: 引用该文档/run 的收藏条数 */
  favoriteCount?: number;
  /** DELETE_BLOCKED_BY_FAVORITES: 清空这些收藏的端点路径（后端给好，前端不要自己拼） */
  clearFavoritesPath?: string;
  /** "document" | "job"，仅用于展示与日志 */
  favoriteScope?: "document" | "job" | "";
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
  const favoriteCount = Number(details?.favorite_count);
  if (Number.isFinite(favoriteCount) && favoriteCount > 0) {
    error.favoriteCount = favoriteCount;
  }
  const clearPath = `${details?.clear_favorites_path || ""}`.trim();
  if (clearPath) error.clearFavoritesPath = clearPath;
  const scope = `${details?.scope || ""}`.trim();
  if (scope === "document" || scope === "job") error.favoriteScope = scope;
  return error;
}

export async function fetchDocumentList(
  apiPrefix: string,
  { limit = 50, offset = 0, readingStatus = "", tag = "", collectionId = "", q = "" }: DocumentListQuery = {},
): Promise<DocumentListView> {
  const params = new URLSearchParams();
  params.set("limit", `${limit}`);
  params.set("offset", `${offset}`);
  if (`${readingStatus || ""}`.trim()) params.set("reading_status", `${readingStatus}`.trim());
  if (`${tag || ""}`.trim()) params.set("tag", `${tag}`.trim());
  if (`${collectionId || ""}`.trim()) params.set("collection_id", `${collectionId}`.trim());
  if (`${q || ""}`.trim()) params.set("q", `${q}`.trim());
  const resp = await apiFetch(`${buildApiEndpoint(apiPrefix, "documents")}?${params.toString()}`, { headers: buildApiHeaders() });
  if (!resp.ok) throw new Error(`读取文档库失败，请稍后重试。(${resp.status})`);
  return unwrapEnvelope<DocumentListView>(await resp.json());
}

export async function fetchDocumentByJobId(apiPrefix: string, jobId: string): Promise<DocumentRecord | null> {
  const normalized = `${jobId || ""}`.trim();
  if (!normalized) return null;
  const params = new URLSearchParams();
  params.set("job_id", normalized);
  const resp = await apiFetch(`${buildApiEndpoint(apiPrefix, "documents")}?${params.toString()}`, { headers: buildApiHeaders() });
  if (!resp.ok) throw new Error(`按 job 查文档失败，请稍后重试。(${resp.status})`);
  const payload: any = unwrapEnvelope(await resp.json()) || { documents: [], total: 0, limit: 0, offset: 0 };
  const { documents = [] } = payload;
  return Array.isArray(documents) && documents.length ? documents[0] : null;
}

export async function fetchDocument(apiPrefix: string, documentId: string): Promise<DocumentRecord> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) throw new Error("缺少 document_id。");
  const resp = await apiFetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}`), { headers: buildApiHeaders() });
  if (!resp.ok) throw new Error(`读取文档详情失败，请稍后重试。(${resp.status})`);
  return unwrapEnvelope<DocumentRecord>(await resp.json());
}

export async function patchDocument(apiPrefix: string, documentId: string, payload: Record<string, unknown> = {}): Promise<DocumentRecord> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) throw new Error("缺少 document_id。");
  const resp = await apiFetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}`), {
    method: "PATCH",
    headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const envelope: any = await resp.json().catch(() => null);
    throw new Error(`${envelope?.message || "更新文档失败，请稍后重试。"}(${resp.status})`);
  }
  return unwrapEnvelope<DocumentRecord>(await resp.json());
}

/** GET /documents/:id/reading —— 阅读器该打开哪个任务。 */
export type DocumentReadingView = {
  /** 该打开的任务 id；多次范围翻译拼成的是 `merged-<文档>-<指纹>`。null = 还没有可读的译文。 */
  job_id: string | null;
  merged: boolean;
  contributing_job_ids: string[];
};

export async function fetchDocumentReading(apiPrefix: string, documentId: string): Promise<DocumentReadingView> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) throw new Error("缺少 document_id。");
  const resp = await apiFetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/reading`), {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) throw new Error(`读取阅读入口失败。(${resp.status})`);
  return unwrapEnvelope<DocumentReadingView>(await resp.json());
}

/** GET /documents/:id/translation-coverage —— 一本书翻了哪些页、每次任务提供了几页。 */
export type TranslationCoverageSegment = { first: number; last: number; job_id: string | null };
export type TranslationCoverageJob = {
  job_id: string;
  workflow: string;
  status: string;
  created_at: string;
  finished_at: string | null;
  model: string;
  /** 这个任务处理的文档页（1 起）。 */
  pages: number[];
  /** 当前合并结果里取自它的页数。 */
  supplied_pages: number;
  ocr_reused: boolean;
  /** 成功但有额外说明（「N 个内容块保留原文未翻译」）。旧后端没有这个字段。 */
  note?: string | null;
  /** 成功的翻译任务里保留原文的内容块数。 */
  kept_origin_blocks?: number;
  /** 其中落在「当前合并结果仍取自这个任务」的页上的块数（分次范围翻译后不会偏大）。 */
  kept_origin_blocks_supplied?: number;
  /** 失败原因一句话（中文）。只有失败任务有。 */
  failure_summary?: string | null;
  /** 原始错误第一行，展开看原因用。只有失败任务有。 */
  error_head?: string | null;
};
export type TranslationCoverageView = {
  page_count: number;
  translated_pages: number;
  contributing_jobs: number;
  segments: TranslationCoverageSegment[];
  jobs: TranslationCoverageJob[];
};

export async function fetchDocumentTranslationCoverage(
  apiPrefix: string,
  documentId: string,
): Promise<TranslationCoverageView> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) throw new Error("缺少 document_id。");
  const resp = await apiFetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/translation-coverage`), {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) throw new Error(`读取翻译覆盖失败。(${resp.status})`);
  return unwrapEnvelope<TranslationCoverageView>(await resp.json());
}

export async function createDocumentMetadataSuggestion(
  apiPrefix: string,
  documentId: string,
  payload: CreateDocumentMetadataSuggestionInput = {},
): Promise<DocumentMetadataSuggestion> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) throw new Error("缺少 document_id。");
  const resp = await apiFetch(
    buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/metadata-suggestions`),
    {
      method: "POST",
      headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!resp.ok) {
    const envelope: any = await resp.json().catch(() => null);
    throw documentRequestError("生成文档元数据建议失败。", resp.status, envelope);
  }
  return unwrapEnvelope<DocumentMetadataSuggestion>(await resp.json());
}

export async function fetchDocumentMetadataSuggestions(
  apiPrefix: string,
  documentId: string,
  { limit = 20 }: { limit?: number } = {},
): Promise<DocumentMetadataSuggestion[]> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) return [];
  const params = new URLSearchParams({ limit: `${limit}` });
  const resp = await apiFetch(
    `${buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/metadata-suggestions`)}?${params.toString()}`,
    { headers: buildApiHeaders() },
  );
  if (!resp.ok) {
    const envelope: any = await resp.json().catch(() => null);
    throw documentRequestError("读取文档元数据建议失败。", resp.status, envelope);
  }
  const payload = unwrapEnvelope<{ suggestions?: DocumentMetadataSuggestion[] }>(await resp.json());
  return Array.isArray(payload?.suggestions) ? payload.suggestions : [];
}

export async function applyDocumentMetadataSuggestion(
  apiPrefix: string,
  documentId: string,
  suggestionId: string,
  payload: ApplyDocumentMetadataSuggestionInput = {},
): Promise<{ suggestion: DocumentMetadataSuggestion; document: DocumentRecord }> {
  const normalizedDocumentId = `${documentId || ""}`.trim();
  const normalizedSuggestionId = `${suggestionId || ""}`.trim();
  if (!normalizedDocumentId) throw new Error("缺少 document_id。");
  if (!normalizedSuggestionId) throw new Error("缺少 suggestion_id。");
  const resp = await apiFetch(
    buildApiEndpoint(
      apiPrefix,
      `documents/${encodeURIComponent(normalizedDocumentId)}/metadata-suggestions/${encodeURIComponent(normalizedSuggestionId)}/apply`,
    ),
    {
      method: "POST",
      headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!resp.ok) {
    const envelope: any = await resp.json().catch(() => null);
    throw documentRequestError("应用文档元数据建议失败。", resp.status, envelope);
  }
  return unwrapEnvelope(await resp.json());
}

export async function deleteDocument(apiPrefix: string, documentId: string, { force = false }: { force?: boolean } = {}): Promise<any> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) throw new Error("缺少 document_id。");
  const params = force ? "?force=true" : "";
  const resp = await apiFetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}`) + params, { method: "DELETE", headers: buildApiHeaders() });
  if (!resp.ok) {
    const envelope: any = await resp.json().catch(() => null);
    // 保留结构化 error.code / error.details（收藏保护 409 靠它拿条数和清空路径）
    throw documentRequestError("删除文档失败，请稍后重试。", resp.status, envelope);
  }
  return unwrapEnvelope(await resp.json());
}

/**
 * DELETE `clear_favorites_path`（后端在 DELETE_BLOCKED_BY_FAVORITES 的
 * error.details 里给好的路径，文档级/run 级共用）。幂等：没有收藏返回 0；
 * 目标不存在是 404。返回实际删除的收藏条数。
 */
export async function clearFavorites(
  apiPrefix: string,
  clearFavoritesPath: string,
): Promise<number> {
  const raw = `${clearFavoritesPath || ""}`.trim();
  if (!raw) return 0;
  const prefix = `${apiPrefix || ""}`.replace(/\/+$/, "");
  const relative = prefix && raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
  const resp = await apiFetch(buildApiEndpoint(apiPrefix, relative.replace(/^\/+/, "")), {
    method: "DELETE",
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    const envelope: any = await resp.json().catch(() => null);
    throw documentRequestError("清空收藏失败，请稍后重试。", resp.status, envelope);
  }
  const payload: any = unwrapEnvelope(await resp.json());
  return Number(payload?.deleted_count) || 0;
}

export async function translateDocument(
  apiPrefix: string,
  documentId: string,
  payload: Record<string, unknown> = {},
): Promise<DocumentJobSubmissionView> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) throw new Error("缺少 document_id。");
  const resp = await apiFetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/translate`), {
    method: "POST",
    headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const envelope: any = await resp.json().catch(() => null);
    throw pageQuotaErrorFromPayload(resp.status, envelope) ?? documentRequestError("发起翻译失败，请稍后重试。", resp.status, envelope);
  }
  return unwrapEnvelope<DocumentJobSubmissionView>(await resp.json());
}

export async function ocrDocument(
  apiPrefix: string,
  documentId: string,
  payload: Record<string, unknown> = {},
): Promise<any> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) throw new Error("缺少 document_id。");
  const resp = await apiFetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/ocr`), {
    method: "POST",
    headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const envelope: any = await resp.json().catch(() => null);
    throw pageQuotaErrorFromPayload(resp.status, envelope) ?? new Error(`${envelope?.message || "发起 OCR 失败，请稍后重试。"}(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
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
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) return { items: [] };
  const params = new URLSearchParams();
  params.set("limit", `${limit}`);
  params.set("offset", `${offset}`);
  const resp = await apiFetch(
    `${buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/jobs`)}?${params.toString()}`,
    { headers: buildApiHeaders() },
  );
  if (!resp.ok) throw new Error(`读取文档任务失败，请稍后重试。(${resp.status})`);
  const payload = unwrapEnvelope<DocumentJobsView>(await resp.json());
  return {
    ...payload,
    items: Array.isArray(payload?.items) ? payload.items : [],
  };
}
