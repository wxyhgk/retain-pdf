import {
  buildFrontendPageUrl,
  isMockMode,
} from "@/platform/config/runtime.js";

export function createJobDetailConfigPort({
  buildPageUrl = buildFrontendPageUrl,
  isMock = isMockMode,
} = {}) {
  function buildReaderPageUrl(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
      return "";
    }
    return buildPageUrl("./reader.html", {
      job_id: normalizedJobId,
    });
  }

  function buildDetailPageUrl(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
      return "";
    }
    return buildPageUrl("./detail.html", {
      job_id: normalizedJobId,
    });
  }

  function detailShareNote() {
    return isMock()
      ? "当前为 mock 明细页，可直接分享当前链接。"
      : "当前详情页可直接通过 URL 分享给其他人。";
  }

  return Object.freeze({
    buildDetailPageUrl,
    buildReaderPageUrl,
    detailShareNote,
    isMock,
  });
}

export const defaultJobDetailConfigPort = createJobDetailConfigPort();
