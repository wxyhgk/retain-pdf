import { apiBase, buildApiHeaders, buildApiUrl, frontendApiKey, isMockMode } from "./config.js";
import { unwrapEnvelope } from "./job.js";
import {
  fetchMockProtected,
  getMockJobArtifactsManifest,
  getMockJobEvents,
  getMockJobList,
  getMockJobMarkdown,
  getMockJobPayload,
  submitMockJob,
  submitMockUpload,
} from "./mock.js";

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

function assertGroupedJobPayload(payload) {
  if (!isObject(payload)) {
    throw new Error("提交失败: /api/v1/jobs 需要 JSON object 请求体。");
  }
  if (!payload.workflow || !isObject(payload.source)) {
    throw new Error("提交失败: /api/v1/jobs 必须使用 grouped JSON，至少包含 workflow 和 source。");
  }
  const legacyTopLevelFields = [
    "upload_id",
    "artifact_job_id",
    "mode",
    "model",
    "base_url",
    "api_key",
    "mineru_token",
    "paddle_token",
    "model_version",
    "language",
    "render_mode",
    "skip_title_translation",
    "batch_size",
    "workers",
    "classify_batch_size",
    "compile_workers",
    "rule_profile_name",
    "custom_rules_text",
    "timeout_seconds",
  ];
  const leakedLegacyFields = legacyTopLevelFields.filter((field) => field in payload);
  if (leakedLegacyFields.length > 0) {
    throw new Error(
      `提交失败: /api/v1/jobs 不再接受旧扁平字段，发现 ${leakedLegacyFields.join(", ")}。请改为 source/ocr/translation/render/runtime 分组结构。`,
    );
  }
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

export async function submitJobRequest(apiPrefix, payload) {
  assertGroupedJobPayload(payload);
  return submitJson(buildJobsEndpoint(apiPrefix, "jobs"), payload);
}

export async function fetchJobPayload(jobId, apiPrefix) {
  if (isMockMode()) {
    void apiPrefix;
    return getMockJobPayload(jobId);
  }
  const resp = await fetch(buildJobDetailEndpoint(jobId, apiPrefix), {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      throw new Error("未找到该任务，请检查 job_id 是否正确。");
    }
    throw new Error(`读取任务失败，请稍后重试。(${resp.status})`);
  }
  const payloadJson = await resp.json();
  return unwrapEnvelope(payloadJson);
}

export async function fetchJobEvents(jobId, apiPrefix, limit = 50, offset = 0) {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    const payload = getMockJobEvents();
    return { ...payload, limit, offset };
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/events?limit=${limit}&offset=${offset}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      return { items: [], limit, offset };
    }
    throw new Error(`读取事件流失败，请稍后重试。(${resp.status})`);
  }
  const payloadJson = await resp.json();
  return unwrapEnvelope(payloadJson);
}

export async function fetchJobArtifactsManifest(jobId, apiPrefix) {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    return getMockJobArtifactsManifest();
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/artifacts-manifest`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      return { items: [] };
    }
    throw new Error(`读取产物清单失败，请稍后重试。(${resp.status})`);
  }
  const payloadJson = await resp.json();
  return unwrapEnvelope(payloadJson);
}

export async function fetchJobMarkdown(jobId, apiPrefix) {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    return getMockJobMarkdown();
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/markdown`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      return null;
    }
    throw new Error(`读取 Markdown 失败，请稍后重试。(${resp.status})`);
  }
  const payloadJson = await resp.json();
  return unwrapEnvelope(payloadJson);
}

export async function fetchTranslationDiagnostics(jobId, apiPrefix) {
  if (isMockMode()) {
    return {
      job_id: jobId,
      summary: {
        schema: "translation_diagnostics_v1",
        counts: {},
        final_status_counts: {},
      },
    };
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/translation/diagnostics`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      throw new Error("未找到翻译调试信息，请确认该任务已完成翻译。");
    }
    throw new Error(`读取翻译调试摘要失败，请稍后重试。(${resp.status})`);
  }
  const payloadJson = await resp.json();
  return unwrapEnvelope(payloadJson);
}

export async function fetchTranslationItems(
  jobId,
  apiPrefix,
  {
    limit = 20,
    offset = 0,
    page = "",
    finalStatus = "",
    errorType = "",
    route = "",
    q = "",
  } = {},
) {
  if (isMockMode()) {
    return {
      items: [],
      total: 0,
      limit,
      offset,
    };
  }
  const params = new URLSearchParams();
  params.set("limit", `${limit}`);
  params.set("offset", `${offset}`);
  if (`${page ?? ""}`.trim()) {
    params.set("page", `${page}`.trim());
  }
  if (`${finalStatus ?? ""}`.trim()) {
    params.set("final_status", `${finalStatus}`.trim());
  }
  if (`${errorType ?? ""}`.trim()) {
    params.set("error_type", `${errorType}`.trim());
  }
  if (`${route ?? ""}`.trim()) {
    params.set("route", `${route}`.trim());
  }
  if (`${q ?? ""}`.trim()) {
    params.set("q", `${q}`.trim());
  }
  const resp = await fetch(
    `${buildJobDetailEndpoint(jobId, apiPrefix)}/translation/items?${params.toString()}`,
    {
      headers: buildApiHeaders(),
    },
  );
  if (!resp.ok) {
    if (resp.status === 404) {
      return { items: [], total: 0, limit, offset };
    }
    throw new Error(`读取翻译调试列表失败，请稍后重试。(${resp.status})`);
  }
  const payloadJson = await resp.json();
  return unwrapEnvelope(payloadJson);
}

export async function fetchTranslationItem(jobId, itemId, apiPrefix) {
  if (isMockMode()) {
    return {
      job_id: jobId,
      item_id: itemId,
      page_idx: 0,
      page_number: 1,
      page_path: "",
      item: {},
    };
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/translation/items/${itemId}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      throw new Error("未找到该翻译 item，请确认 item_id 是否正确。");
    }
    throw new Error(`读取翻译 item 详情失败，请稍后重试。(${resp.status})`);
  }
  const payloadJson = await resp.json();
  return unwrapEnvelope(payloadJson);
}

export async function replayTranslationItem(jobId, itemId, apiPrefix) {
  if (isMockMode()) {
    return {
      job_id: jobId,
      item_id: itemId,
      payload: {
        policy_before: {},
        policy_after: {},
        replay_result: {},
        replay_error: null,
      },
    };
  }
  const resp = await fetch(
    `${buildJobDetailEndpoint(jobId, apiPrefix)}/translation/items/${itemId}/replay`,
    {
      method: "POST",
      headers: buildApiHeaders(),
    },
  );
  if (!resp.ok) {
    const contentType = resp.headers.get("content-type") || "";
    if (resp.status === 404) {
      throw new Error("未找到该翻译 item，无法重放。");
    }
    if (contentType.includes("application/json")) {
      const errorPayload = await resp.json();
      throw new Error(`重放翻译 item 失败: ${errorPayload.message || JSON.stringify(errorPayload)}`);
    }
    const text = await resp.text();
    throw new Error(`重放翻译 item 失败: ${resp.status} ${text}`);
  }
  const payloadJson = await resp.json();
  return unwrapEnvelope(payloadJson);
}

export async function fetchJobList(
  apiPrefix,
  {
    limit = 20,
    offset = 0,
    status = "",
    workflow = "",
    provider = "",
    scope = "jobs",
  } = {},
) {
  if (isMockMode()) {
    void apiPrefix;
    return getMockJobList();
  }
  const params = new URLSearchParams();
  params.set("limit", `${limit}`);
  params.set("offset", `${offset}`);
  if (status) {
    params.set("status", status);
  }
  if (workflow) {
    params.set("workflow", workflow);
  }
  if (provider) {
    params.set("provider", provider);
  }
  const resp = await fetch(`${buildJobsEndpoint(apiPrefix, scope)}?${params.toString()}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`读取最近任务失败，请稍后重试。(${resp.status})`);
  }
  const payloadJson = await resp.json();
  return unwrapEnvelope(payloadJson);
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
      reject(new Error(`提交失败: ${xhr.status} ${message}`));
    });

    xhr.addEventListener("error", () => {
      reject(new Error(`提交失败: 网络错误。当前 API Base 为 ${apiBase()}，上传地址为 ${url}。请确认本地服务已经启动。`));
    });

    xhr.send(form);
  });
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

export async function validateMineruToken(apiPrefix, payload) {
  if (isMockMode()) {
    void apiPrefix;
    void payload;
    return {
      ok: true,
      valid: true,
      summary: "mock mode: token validation skipped",
    };
  }
  return submitJson(buildApiEndpoint(apiPrefix, "providers/mineru/validate-token"), payload);
}

export async function validatePaddleToken(apiPrefix, payload) {
  if (isMockMode()) {
    void apiPrefix;
    void payload;
    return {
      ok: true,
      valid: true,
      summary: "mock mode: token validation skipped",
    };
  }
  return submitJson(buildApiEndpoint(apiPrefix, "providers/paddle/validate-token"), payload);
}

export async function validateDeepSeekToken(apiPrefix, payload) {
  if (isMockMode()) {
    void apiPrefix;
    void payload;
    return {
      ok: true,
      valid: true,
      summary: "mock mode: token validation skipped",
    };
  }
  return submitJson(buildApiEndpoint(apiPrefix, "providers/deepseek/validate-token"), payload);
}

export async function fetchProtected(url, options = {}) {
  if (isMockMode() && `${url || ""}`.startsWith("mock://")) {
    return fetchMockProtected(url);
  }
  const headers = buildApiHeaders(options.headers || {});
  return fetch(url, {
    ...options,
    headers,
  });
}
