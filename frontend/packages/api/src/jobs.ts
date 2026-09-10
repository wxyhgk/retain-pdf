// Jobs API — standalone, wraps job-status.v1
// No frontend/web deps; browser-aware (reads window.__FRONT_RUNTIME_CONFIG__ for apiBase / X-API-Key if present).

import { API_PREFIX, buildApiHeaders, buildApiUrl, unwrapEnvelope } from "./internal/runtime.js";
import type { JobDetailView, JobListView } from "@retainpdf/contracts/job-status";

function buildJobsEndpoint(apiPrefix: string | undefined, scope = "jobs"): string {
  return buildApiUrl(apiPrefix, scope === "ocr" ? "ocr/jobs" : "jobs");
}
function buildJobDetailEndpoint(jobId: string, apiPrefix: string | undefined, scope = "jobs"): string {
  return `${buildJobsEndpoint(apiPrefix, scope === "ocr" ? "ocr" : "jobs")}/${encodeURIComponent(jobId)}`;
}
function buildOcrJobDetailEndpoint(jobId: string, apiPrefix: string | undefined): string {
  return buildJobDetailEndpoint(jobId, apiPrefix, "ocr");
}

export type FetchJobPayloadOptions = { apiPrefix?: string };

function jobRequestError(message: string, status: number): Error & { status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function normalizeJobPayloadArgs(
  a: string,
  b?: string | FetchJobPayloadOptions,
): { jobId: string; apiPrefix: string | undefined } {
  // Deprecated swapped order: (apiPrefix, jobId) heuristics via a.startsWith("/")
  if (
    typeof a === "string" &&
    a.startsWith("/") &&
    typeof b === "string" &&
    b != null &&
    !b.startsWith("/")
  ) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(
        "[deprecated] fetchJobPayload(apiPrefix, jobId) is deprecated, use fetchJobPayload(jobId, { apiPrefix })",
      );
    }
    return { apiPrefix: a, jobId: b };
  }
  if (typeof b === "string") {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(
        "[deprecated] fetchJobPayload(jobId, apiPrefix) string form is deprecated, use fetchJobPayload(jobId, { apiPrefix })",
      );
    }
    return { jobId: a, apiPrefix: b };
  }
  if (b && typeof b === "object") {
    return { jobId: a, apiPrefix: (b as FetchJobPayloadOptions).apiPrefix };
  }
  return { jobId: a, apiPrefix: undefined };
}

export async function fetchJobPayload(jobId: string, options?: FetchJobPayloadOptions): Promise<JobDetailView>;
/** @deprecated string form: use fetchJobPayload(jobId, { apiPrefix }) */
export async function fetchJobPayload(jobId: string, apiPrefix?: string): Promise<JobDetailView>;
/** @deprecated swapped order: use fetchJobPayload(jobId, { apiPrefix }) */
export async function fetchJobPayload(apiPrefix: string, jobId: string): Promise<JobDetailView>;
export async function fetchJobPayload(a: string, b?: string | FetchJobPayloadOptions): Promise<JobDetailView> {
  const { jobId, apiPrefix } = normalizeJobPayloadArgs(a, b);
  const normalizedJobId = `${jobId || ""}`.trim();
  if (!normalizedJobId) throw new Error("读取任务失败: 缺少 job_id");
  // Try generic endpoint first (covers both translation and OCR; OCR also readable via generic).
  // If 404, retry OCR-specific endpoint to handle strict OCR-only routing.
  let resp = await fetch(buildJobDetailEndpoint(normalizedJobId, apiPrefix), { headers: buildApiHeaders() });
  if (resp.status === 404) {
    const ocrResp = await fetch(buildOcrJobDetailEndpoint(normalizedJobId, apiPrefix), { headers: buildApiHeaders() });
    if (ocrResp.ok) return unwrapEnvelope<JobDetailView>(await ocrResp.json());
    // keep original 404 semantics if both miss
    if (!ocrResp.ok && ocrResp.status !== 404) {
      throw new Error(`读取任务失败，请稍后重试。(${ocrResp.status})`);
    }
  }
  if (!resp.ok) {
    if (resp.status === 404) {
      throw jobRequestError("未找到该任务，请检查 job_id 是否正确。", 404);
    }
    throw jobRequestError(`读取任务失败，请稍后重试。(${resp.status})`, resp.status);
  }
  return unwrapEnvelope<JobDetailView>(await resp.json());
}

export async function fetchJobList(
  apiPrefix: string = API_PREFIX,
  {
    limit = 20,
    offset = 0,
    status = "",
    workflow = "",
    provider = "",
    scope = "jobs",
    q = "",
  }: {
    limit?: number;
    offset?: number;
    status?: string;
    workflow?: string;
    provider?: string;
    scope?: string;
    q?: string;
  } = {},
): Promise<JobListView> {
  const params = new URLSearchParams();
  params.set("limit", `${limit}`);
  params.set("offset", `${offset}`);
  if (status) params.set("status", status);
  if (workflow) params.set("workflow", workflow);
  if (provider) params.set("provider", provider);
  if (`${q || ""}`.trim()) params.set("q", `${q || ""}`.trim());
  const endpoint = buildJobsEndpoint(apiPrefix, scope);
  const resp = await fetch(`${endpoint}?${params.toString()}`, { headers: buildApiHeaders() });
  if (!resp.ok) throw new Error(`读取最近任务失败，请稍后重试。(${resp.status})`);
  return unwrapEnvelope<JobListView>(await resp.json());
}
