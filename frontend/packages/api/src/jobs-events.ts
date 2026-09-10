// jobs-events — pure
import { buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildJobDetailEndpoint } from "./http.js";
import type { JobEventListView } from "@retainpdf/contracts/job-status";

function buildOcrJobDetailEndpoint(jobId: string, apiPrefix?: string): string {
  // http.ts buildJobDetailEndpoint always uses jobs scope; construct OCR manually via buildJobsEndpoint
  // Avoid circular import by building directly: buildApiUrl handles prefix + "ocr/jobs/<id>"
  // Use buildJobDetailEndpoint for jobs, manual for ocr fallback.
  const jobsEndpoint = buildJobDetailEndpoint(jobId, apiPrefix);
  // jobsEndpoint is .../jobs/<id>; replace trailing "/jobs/<id>" with "/ocr/jobs/<id>" for fallback
  return jobsEndpoint.replace(/\/jobs\//, "/ocr/jobs/");
}

export async function fetchJobEvents(
  jobId: string,
  apiPrefix?: string,
  limit = 50,
  offset = 0,
): Promise<JobEventListView> {
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/events?limit=${limit}&offset=${offset}`, { headers: buildApiHeaders() });
  if (!resp.ok) {
    if (resp.status === 404) {
      const ocrResp = await fetch(`${buildOcrJobDetailEndpoint(jobId, apiPrefix)}/events?limit=${limit}&offset=${offset}`, { headers: buildApiHeaders() });
      if (ocrResp.ok) return unwrapEnvelope<JobEventListView>(await ocrResp.json());
      if (ocrResp.status === 404) return { items: [], limit, offset };
      // keep original handling if OCR also fails differently
    }
    if (resp.status === 404) return { items: [], limit, offset };
    throw new Error(`读取事件流失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope<JobEventListView>(await resp.json());
}
