import { createRecentJobsReaderPort } from "./reader-port.js";
import { createRecentJobsRuntimePort } from "./job-runtime-port.js";

export function createRecentJobsNavigationPort({
  currentJobId = () => "",
  doc = document,
  jobRuntimePort = createRecentJobsRuntimePort({ currentJobId }),
  readerPort = createRecentJobsReaderPort(),
}: any = {}) {

  return {
    currentJobId() {
      return `${jobRuntimePort.currentJobId?.() || currentJobId?.() || ""}`.trim();
    },

    openJob(jobId) {
      const normalizedJobId = `${jobId || ""}`.trim();
      if (!normalizedJobId) {
        return false;
      }
      // 进度在书籍详情的「进度」页，不弹旧工作流窗。
      return jobRuntimePort.openJob?.(normalizedJobId) !== false;
    },

    openReader(jobId, documentId = "", options: { pinJob?: boolean } = {}) {
      const normalizedJobId = `${jobId || ""}`.trim();
      if (!normalizedJobId) {
        return false;
      }
      return readerPort.openReader?.(normalizedJobId, null, `${documentId || ""}`.trim(), options) !== false;
    },

    recoverJob(jobId) {
      const normalizedJobId = `${jobId || ""}`.trim();
      if (!normalizedJobId) {
        return false;
      }
      // 优先 recoverJob（silent poll）；兼容旧 port 仅有 openJob
      if (typeof jobRuntimePort.recoverJob === "function") {
        return jobRuntimePort.recoverJob(normalizedJobId) !== false;
      }
      return jobRuntimePort.openJob?.(normalizedJobId) !== false;
    },
  };
}
