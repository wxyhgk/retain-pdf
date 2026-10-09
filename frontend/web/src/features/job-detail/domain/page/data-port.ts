import { API_PREFIX } from "@/platform/config/api-constants.js";
import {
  fetchJobArtifactsManifest,
  fetchJobMarkdown,
} from "@/platform/api/index.js";
import {
  fetchJobDiagnostics,
  fetchResumePlan,
  rerunJob,
  resumeJob,
} from "@/platform/api/index.js";
import {
  fetchJobEvents,
} from "@/platform/api/index.js";
import { fetchJobPayload } from "@/platform/api/index.js";
import { fetchProtected } from "@/platform/api/index.js";

export function createJobDetailDataPort({
  apiPrefix = API_PREFIX,
  loadJob = fetchJobPayload,
  loadManifest = fetchJobArtifactsManifest,
  loadDiagnostics = fetchJobDiagnostics,
  loadResumePlan = fetchResumePlan,
  loadMarkdown = fetchJobMarkdown,
  loadEvents = fetchJobEvents,
  rerun = rerunJob,
  resume = resumeJob,
  fetchProtectedResource = fetchProtected,
} = {}) {
  async function loadOverview(jobId: string) {
    const [payloadRaw, manifestPayload, diagnosticsPayload, resumePlan] = await Promise.all([
      loadJob(jobId, { apiPrefix }),
      loadManifest(jobId, apiPrefix),
      loadDiagnostics(jobId, apiPrefix).catch(() => null),
      loadResumePlan(jobId, apiPrefix).catch(() => null),
    ]);
    return {
      diagnosticsPayload,
      manifestPayload,
      payloadRaw,
      resumePlan,
    };
  }

  // 只走 /markdown JSON（content + raw_url + images_base_url）；不再用昂贵的
  // /markdown/document（整篇返回两份 + walkdir images）。这条端点因此可删。
  async function loadMarkdownPayload(jobId: string) {
    return await loadMarkdown(jobId, apiPrefix);
  }

  return Object.freeze({
    apiPrefix,
    fetchJobEvents: loadEvents,
    fetchProtected: fetchProtectedResource,
    loadMarkdownPayload,
    loadOverview,
    rerunJob: rerun,
    resumeJob: resume,
  });
}

export const defaultJobDetailDataPort = createJobDetailDataPort();
