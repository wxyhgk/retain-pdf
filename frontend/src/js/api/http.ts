import {
  apiBase,
  buildApiHeaders,
  buildApiUrl,
  frontendApiKey,
  isMockMode,
} from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import { fetchMockProtected, submitMockJob, submitMockUpload } from "../mock/index.js";

/** Kiểu lỗi linh hoạt gắn status/url khi yêu cầu HTTP thất bại */
export interface HttpError extends Error {
  status?: number;
  url?: string;
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function summarizeJobRequestContext(payload) {
  if (!isObject(payload)) {
    return "";
  }
  const workflow = `${payload.workflow || ""}`.trim();
  const provider = `${payload.ocr?.provider || ""}`.trim();
  const uploadId = `${payload.source?.upload_id || ""}`.trim();
  const artifactJobId = `${payload.source?.artifact_job_id || ""}`.trim();
  const parts = [];
  if (workflow) {
    parts.push(`workflow=${workflow}`);
  }
  if (provider) {
    parts.push(`ocr.provider=${provider}`);
  }
  if (uploadId) {
    parts.push(`source.upload_id=${uploadId}`);
  }
  if (artifactJobId) {
    parts.push(`source.artifact_job_id=${artifactJobId}`);
  }
  return parts.length > 0 ? ` [${parts.join(", ")}]` : "";
}

export function buildApiEndpoint(apiPrefix, relativePath = "") {
  return buildApiUrl(apiPrefix, relativePath);
}

export function buildJobsEndpoint(apiPrefix, scope = "jobs") {
  return buildApiEndpoint(apiPrefix, scope === "ocr" ? "ocr/jobs" : "jobs");
}

export function buildJobDetailEndpoint(jobId, apiPrefix) {
  return buildJobsEndpoint(apiPrefix, "jobs") + `/${jobId}`;
}

export async function submitJson(url, payload) {
  if (isMockMode()) {
    void payload;
    if (/\/jobs(?:$|\?)/.test(url)) {
      return submitMockJob();
    }
    if (/\/cancel(?:$|\?)/.test(url)) {
      return { ok: true };
    }
  }
  const resp = await fetch(url, {
    method: "POST",
    headers: buildApiHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const requestContext = /\/api\/v1\/jobs(?:$|\?)/.test(url)
      ? summarizeJobRequestContext(payload)
      : "";
    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
     const errorPayload = await resp.json();
       throw new Error(`Gửi thất bại: ${resp.status} ${errorPayload.message || JSON.stringify(errorPayload)}${requestContext}`);
     }
     const text = await resp.text();
     throw new Error(`Gửi thất bại: ${resp.status} ${text}${requestContext}`);
  }
  if (resp.status === 204) {
    return { ok: true };
  }
  const contentType = (resp.headers.get("content-type") || "").toLowerCase();
  const text = await resp.text();
  if (!text.trim()) {
    return { ok: true };
  }
  if (!contentType.includes("application/json")) {
    return text;
  }
  return unwrapEnvelope(JSON.parse(text));
}

export function submitUploadRequest(url, form, onProgress) {
  if (isMockMode()) {
    void url;
    void form;
    onProgress?.(1, 1);
    return Promise.resolve(submitMockUpload());
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    const apiKey = frontendApiKey();
    if (apiKey) {
      xhr.setRequestHeader("X-API-Key", apiKey);
    }

    xhr.upload.addEventListener("progress", (event) => {
      if (!onProgress) {
        return;
      }
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      } else {
        onProgress(NaN, NaN);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(unwrapEnvelope(xhr.response));
        return;
      }
      const message = typeof xhr.response === "object" && xhr.response
        ? (xhr.response.message || JSON.stringify(xhr.response))
        : (xhr.responseText || "");
       const error = new Error(`Gửi thất bại: ${xhr.status} ${message}`) as HttpError;
      error.status = xhr.status;
      error.url = url;
      reject(error);
    });

     xhr.addEventListener("error", () => {
       const error = new Error(`Gửi thất bại: lỗi mạng. API Base hiện tại là ${apiBase()}, địa chỉ tải lên là ${url}. Vui lòng xác nhận dịch vụ cục bộ đã khởi động.`) as HttpError;
       error.url = url;
       reject(error);
     });

    xhr.send(form);
  });
}

export async function fetchProtected(url, options: RequestInit = {}) {
  if (isMockMode() && `${url || ""}`.startsWith("mock://")) {
    return fetchMockProtected(url);
  }
  const headers = buildApiHeaders(options.headers || {});
  return fetch(url, {
    ...options,
    headers,
  });
}
