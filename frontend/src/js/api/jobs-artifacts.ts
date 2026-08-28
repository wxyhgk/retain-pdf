import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import {
  getMockJobArtifactsManifest,
  getMockJobMarkdown,
} from "../mock/index.js";
import { buildJobDetailEndpoint } from "./http.js";

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
    throw new Error(`Đọc danh sách sản phẩm thất bại, vui lòng thử lại sau. (${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
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
    throw new Error(`Đọc Markdown thất bại, vui lòng thử lại sau. (${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function fetchJobMarkdownDocument(jobId, apiPrefix) {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    return getMockJobMarkdown();
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/markdown/document`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      return null;
    }
    throw new Error(`Đọc Markdown có cấu trúc thất bại, vui lòng thử lại sau. (${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}
