import { buildApiHeaders, isMockMode } from "@/platform/config/runtime.js";
import { unwrapEnvelope } from "@retainpdf/domain/job";
import {
  getMockJobArtifactsManifest,
  getMockJobMarkdown,
} from "@/platform/mock/index.js";
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
    throw new Error(`读取产物清单失败，请稍后重试。(${resp.status})`);
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
    throw new Error(`读取 Markdown 失败，请稍后重试。(${resp.status})`);
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
    throw new Error(`读取结构化 Markdown 失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}
