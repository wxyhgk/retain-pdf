// jobs-artifacts — pure (no mock)
import { API_PREFIX, buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildJobDetailEndpoint } from "./http.js";

function buildOcrJobDetailEndpoint(jobId: string, apiPrefix?: string): string {
  return buildJobDetailEndpoint(jobId, apiPrefix).replace(/\/jobs\//, "/ocr/jobs/");
}

export type JobArtifactResourceLink = {
  ready?: boolean;
  path?: string;
  url?: string;
  method?: string;
  content_type?: string;
  file_name?: string | null;
  size_bytes?: number | null;
};

export type JobMarkdownArtifactLink = JobArtifactResourceLink & {
  json_path?: string;
  json_url?: string;
  raw_path?: string;
  raw_url?: string;
  images_base_path?: string;
  images_base_url?: string;
};

export type JobArtifactLinks = {
  pdf_ready?: boolean;
  markdown_ready?: boolean;
  bundle_ready?: boolean;
  pdf_url?: string;
  markdown_url?: string;
  bundle_url?: string;
  normalized_document_url?: string;
  normalization_report_url?: string;
  pdf?: JobArtifactResourceLink;
  markdown?: JobMarkdownArtifactLink;
  bundle?: JobArtifactResourceLink;
  normalized_document?: JobArtifactResourceLink;
  normalization_report?: JobArtifactResourceLink;
  [key: string]: unknown;
};

/**
 * Read the stable, public artifact projection used by the Reader.
 * The detailed manifest is intentionally a separate endpoint and can be empty
 * for older completed jobs even when published downloads are available.
 */
export async function fetchJobArtifacts(jobId: string, apiPrefix = API_PREFIX): Promise<JobArtifactLinks | null> {
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/artifacts`, { headers: buildApiHeaders() });
  if (resp.ok) return unwrapEnvelope(await resp.json());
  if (resp.status !== 404) {
    throw new Error(`读取任务产物失败，请稍后重试。(${resp.status})`);
  }

  const ocrResp = await fetch(`${buildOcrJobDetailEndpoint(jobId, apiPrefix)}/artifacts`, { headers: buildApiHeaders() });
  if (ocrResp.ok) return unwrapEnvelope(await ocrResp.json());
  if (ocrResp.status === 404) return null;
  throw new Error(`读取 OCR 产物失败，请稍后重试。(${ocrResp.status})`);
}

export async function fetchJobArtifactsManifest(jobId: string, apiPrefix = API_PREFIX): Promise<any> {
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/artifacts-manifest`, { headers: buildApiHeaders() });
  if (!resp.ok) {
    if (resp.status === 404) {
      const ocrResp = await fetch(`${buildOcrJobDetailEndpoint(jobId, apiPrefix)}/artifacts-manifest`, { headers: buildApiHeaders() });
      if (ocrResp.ok) return unwrapEnvelope(await ocrResp.json());
      if (ocrResp.status === 404) return { items: [] };
    }
    if (resp.status === 404) return { items: [] };
    throw new Error(`读取产物清单失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function fetchJobMarkdown(jobId: string, apiPrefix = API_PREFIX): Promise<any> {
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/markdown`, { headers: buildApiHeaders() });
  if (!resp.ok) {
    if (resp.status === 404) return null;
    throw new Error(`读取 Markdown 失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function fetchJobMarkdownDocument(jobId: string, apiPrefix = API_PREFIX): Promise<any> {
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/markdown/document`, { headers: buildApiHeaders() });
  if (!resp.ok) {
    if (resp.status === 404) return null;
    throw new Error(`读取结构化 Markdown 失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}
