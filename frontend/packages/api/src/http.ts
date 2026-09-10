// frontend/packages/api/src/http.ts — canonical HTTP primitives (no mock, no window mock branching)
// Mirrors frontend/web/src/js/api/http.ts but pure: uses internal/runtime for apiBase/header/envelope.

import { apiBase, buildApiHeaders, buildApiUrl, frontendApiKey, unwrapEnvelope } from "./internal/runtime.js";

export { apiBase, buildApiHeaders, buildApiUrl, frontendApiKey, unwrapEnvelope };
export { API_PREFIX } from "./internal/runtime.js";

export function buildApiEndpoint(apiPrefix: string | undefined, relativePath = ""): string {
  return buildApiUrl(apiPrefix, relativePath);
}

export function buildJobsEndpoint(apiPrefix: string | undefined, scope = "jobs"): string {
  return buildApiEndpoint(apiPrefix, scope === "ocr" ? "ocr/jobs" : "jobs");
}

export function buildJobDetailEndpoint(jobId: string, apiPrefix: string | undefined): string {
  return `${buildJobsEndpoint(apiPrefix, "jobs")}/${encodeURIComponent(jobId)}`;
}

function isObject(value: unknown): boolean {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function summarizeJobRequestContext(payload: unknown): string {
  if (!isObject(payload)) return "";
  const p = payload as Record<string, unknown>;
  const workflow = `${(p.workflow as string) || ""}`.trim();
  const ocr = p.ocr as Record<string, unknown> | undefined;
  const source = p.source as Record<string, unknown> | undefined;
  const provider = `${(ocr?.provider as string) || ""}`.trim();
  const uploadId = `${(source?.upload_id as string) || ""}`.trim();
  const artifactJobId = `${(source?.artifact_job_id as string) || ""}`.trim();
  const parts: string[] = [];
  if (workflow) parts.push(`workflow=${workflow}`);
  if (provider) parts.push(`ocr.provider=${provider}`);
  if (uploadId) parts.push(`source.upload_id=${uploadId}`);
  if (artifactJobId) parts.push(`source.artifact_job_id=${artifactJobId}`);
  return parts.length > 0 ? ` [${parts.join(", ")}]` : "";
}

export interface HttpError extends Error {
  status?: number;
  url?: string;
}

export async function submitJson(url: string, payload: unknown): Promise<any> {
  const resp = await fetch(url, {
    method: "POST",
    headers: buildApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const requestContext = /\/api\/v1\/jobs(?:$|\?)/.test(url) ? summarizeJobRequestContext(payload) : "";
    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errorPayload: any = await resp.json();
      const error = new Error(`提交失败: ${resp.status} ${errorPayload.message || JSON.stringify(errorPayload)}${requestContext}`) as HttpError;
      error.status = resp.status;
      error.url = url;
      throw error;
    }
    const text = await resp.text();
    const error = new Error(`提交失败: ${resp.status} ${text}${requestContext}`) as HttpError;
    error.status = resp.status;
    error.url = url;
    throw error;
  }
  if (resp.status === 204) return { ok: true };
  const contentType = (resp.headers.get("content-type") || "").toLowerCase();
  const text = await resp.text();
  if (!text.trim()) return { ok: true };
  if (!contentType.includes("application/json")) return text;
  return unwrapEnvelope(JSON.parse(text));
}

export function submitUploadRequest(url: string, form: FormData, onProgress?: (loaded: number, total: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    const apiKey = frontendApiKey();
    if (apiKey) xhr.setRequestHeader("X-API-Key", apiKey);

    xhr.upload.addEventListener("progress", (event: ProgressEvent) => {
      if (!onProgress) return;
      if (event.lengthComputable) onProgress(event.loaded, event.total);
      else onProgress(NaN, NaN);
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(unwrapEnvelope(xhr.response));
        return;
      }
      const message = typeof xhr.response === "object" && xhr.response ? ((xhr.response as any).message || JSON.stringify(xhr.response)) : ((xhr as any).responseText || "");
      const error = new Error(`提交失败: ${xhr.status} ${message}`) as HttpError;
      error.status = xhr.status;
      error.url = url;
      reject(error);
    });

    xhr.addEventListener("error", () => {
      const error = new Error(`提交失败: 网络错误。当前 API Base 为 ${apiBase()}，上传地址为 ${url}。请确认本地服务已经启动。`) as HttpError;
      error.url = url;
      reject(error);
    });

    xhr.send(form);
  });
}

export async function fetchProtected(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = buildApiHeaders((options.headers as Record<string, string>) || {});
  return fetch(url, { ...options, headers });
}
