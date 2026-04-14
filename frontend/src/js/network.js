import { apiBase, buildApiHeaders, frontendApiKey } from "./config.js";
import { unwrapEnvelope } from "./job.js";

export async function fetchJobPayload(jobId, apiPrefix) {
  const resp = await fetch(`${apiBase()}${apiPrefix}/jobs/${jobId}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      throw new Error("未找到该任务，请检查 job_id 是否正确。");
    }
    throw new Error(`读取任务失败，请稍后重试。(${resp.status})`);
  }
  return resp.json();
}

export async function fetchJobEvents(jobId, apiPrefix, limit = 50, offset = 0) {
  const resp = await fetch(`${apiBase()}${apiPrefix}/jobs/${jobId}/events?limit=${limit}&offset=${offset}`, {
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
  const resp = await fetch(`${apiBase()}${apiPrefix}/jobs/${jobId}/artifacts-manifest`, {
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
  const normalizedScope = scope === "ocr" ? "ocr/jobs" : "jobs";
  const resp = await fetch(`${apiBase()}${apiPrefix}/${normalizedScope}?${params.toString()}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`读取最近任务失败，请稍后重试。(${resp.status})`);
  }
  const payloadJson = await resp.json();
  return unwrapEnvelope(payloadJson);
}

export function submitUploadRequest(url, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    const apiKey = frontendApiKey();
    if (apiKey) {
      xhr.setRequestHeader("X-API-KEY", apiKey);
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
  const resp = await fetch(url, {
    method: "POST",
    headers: buildApiHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errorPayload = await resp.json();
      throw new Error(`提交失败: ${resp.status} ${errorPayload.message || JSON.stringify(errorPayload)}`);
    }
    const text = await resp.text();
    throw new Error(`提交失败: ${resp.status} ${text}`);
  }
  const payloadJson = await resp.json();
  return unwrapEnvelope(payloadJson);
}

export async function validateMineruToken(apiPrefix, payload) {
  return submitJson(`${apiBase()}${apiPrefix}/providers/mineru/validate-token`, payload);
}

export async function fetchProtected(url, options = {}) {
  const headers = buildApiHeaders(options.headers || {});
  return fetch(url, {
    ...options,
    headers,
  });
}
