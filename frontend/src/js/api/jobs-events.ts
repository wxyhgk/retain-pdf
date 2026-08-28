import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import { getMockJobEvents } from "../mock/index.js";
import { buildJobDetailEndpoint } from "./http.js";

export async function fetchJobEvents(jobId, apiPrefix, limit = 50, offset = 0) {
  if (isMockMode()) {
    void apiPrefix;
    const payload = getMockJobEvents(jobId);
    return { ...payload, limit, offset };
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/events?limit=${limit}&offset=${offset}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      return { items: [], limit, offset };
    }
    throw new Error(`Đọc luồng sự kiện thất bại, vui lòng thử lại sau. (${resp.status})`);
  }
  return unwrapEnvelope(await resp.json()) as {
    items?: unknown[];
    limit?: number;
    offset?: number;
    [key: string]: unknown;
  };
}
