import {
  apiBase,
  buildApiHeaders,
  buildApiUrl,
  frontendApiKey,
  isMockMode,
} from "@/platform/config/runtime.js";
import { unwrapEnvelope } from "@retainpdf/domain/job";
import { fetchMockProtected, submitMockJob, submitMockUpload } from "@/platform/mock/index.js";

/** HTTP 请求失败时挂载 status/url 的宽松错误类型 */
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
      throw new Error(`提交失败: ${resp.status} ${errorPayload.message || JSON.stringify(errorPayload)}${requestContext}`);
    }
    const text = await resp.text();
    throw new Error(`提交失败: ${resp.status} ${text}${requestContext}`);
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
    void form;
    onProgress?.(1, 1);
    if (/\/ocr\/jobs(?:$|\?)/.test(url)) {
      return Promise.resolve(submitMockJob());
    }
    void url;
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
