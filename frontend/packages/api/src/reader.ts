// reader — pure
import { buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildJobDetailEndpoint, submitJson } from "./http.js";

export async function fetchReaderRegions(jobId: string, apiPrefix?: string): Promise<any> {
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/reader/regions`, { headers: buildApiHeaders() });
  if (!resp.ok) {
    if (resp.status === 404) return { items: [] };
    throw new Error(`读取阅读区域失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function fetchReaderMetadata(jobId: string, apiPrefix?: string): Promise<any> {
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/reader/metadata`, { headers: buildApiHeaders() });
  if (!resp.ok) {
    if (resp.status === 404) return null;
    throw new Error(`读取阅读元数据失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function fetchReaderAiChat(jobId: string, payload: unknown, apiPrefix?: string): Promise<any> {
  return submitJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/reader/ai/chat`, payload);
}
