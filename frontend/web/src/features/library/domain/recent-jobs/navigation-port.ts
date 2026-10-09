import { createRecentJobsReaderPort } from "./reader-port.js";
import { createRecentJobsRuntimePort } from "./job-runtime-port.js";

/** 导航只用到任务运行端口的这几个方法（createRecentJobsRuntimePort 或调用方自备）。 */
export type NavigationJobRuntimePort = {
  currentJobId?: () => string;
  openJob?: (jobId: string) => unknown;
  recoverJob?: (jobId: string) => unknown;
};

export type NavigationReaderPort = {
  openReader?: (jobId: string, anchor: unknown, documentId: string, options: { pinJob?: boolean }) => unknown;
};

export type RecentJobsNavigationPort = ReturnType<typeof createRecentJobsNavigationPort>;

export function createRecentJobsNavigationPort({
  currentJobId = () => "",
  jobRuntimePort = createRecentJobsRuntimePort({ currentJobId }),
  readerPort = createRecentJobsReaderPort(),
}: {
  currentJobId?: () => string;
  jobRuntimePort?: NavigationJobRuntimePort;
  readerPort?: NavigationReaderPort;
} = {}) {

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
