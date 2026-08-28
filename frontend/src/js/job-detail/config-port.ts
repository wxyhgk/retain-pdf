import {
  buildFrontendPageUrl,
  isMockMode,
} from "../config/runtime.js";

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
       ? "Hiện tại là trang chi tiết mock, có thể chia sẻ liên kết hiện tại."
       : "Trang chi tiết hiện tại có thể chia sẻ trực tiếp qua URL cho người khác.";
  }

  return Object.freeze({
    buildDetailPageUrl,
    buildReaderPageUrl,
    detailShareNote,
    isMock,
  });
}

export const defaultJobDetailConfigPort = createJobDetailConfigPort();
