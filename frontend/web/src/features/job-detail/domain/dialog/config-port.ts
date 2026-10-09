import { buildFrontendPageUrl } from "@/platform/config/runtime.js";

export function createStatusDetailConfigPort({
  buildPageUrl = buildFrontendPageUrl,
}: { buildPageUrl?: typeof buildFrontendPageUrl } = {}) {
  function buildDetailPageUrl(jobId: string | null | undefined) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
      return "";
    }
    return buildPageUrl("./detail.html", {
      job_id: normalizedJobId,
    });
  }

  return Object.freeze({
    buildDetailPageUrl,
  });
}

export const defaultStatusDetailConfigPort = createStatusDetailConfigPort();
