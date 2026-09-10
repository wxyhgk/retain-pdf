import { APP_EVENTS } from "@/platform/contracts/app-contract.js";
import { createRecentJobsReaderPort } from "./reader-port.js";
import { createRecentJobsRuntimePort } from "./job-runtime-port.js";

export function createRecentJobsNavigationPort({
  closeDialog,
  currentJobId = () => "",
  doc = document,
  jobRuntimePort = createRecentJobsRuntimePort({ currentJobId }),
  readerPort = createRecentJobsReaderPort(),
  /** 图书馆网格默认 false：进度在书籍详情 Tab，不弹旧工作流窗 */
  openWorkflowOnSelect = false,
}: any = {}) {
  function openWorkflow() {
    doc?.dispatchEvent?.(new CustomEvent(APP_EVENTS.openTranslationWorkflow));
  }

  return {
    currentJobId() {
      return `${jobRuntimePort.currentJobId?.() || currentJobId?.() || ""}`.trim();
    },

    openJob(jobId) {
      const normalizedJobId = `${jobId || ""}`.trim();
      if (!normalizedJobId) {
        return false;
      }
      closeDialog?.();
      if (openWorkflowOnSelect) {
        openWorkflow();
      }
      return jobRuntimePort.openJob?.(normalizedJobId) !== false;
    },

    openReader(jobId, documentId = "") {
      const normalizedJobId = `${jobId || ""}`.trim();
      if (!normalizedJobId) {
        return false;
      }
      closeDialog?.();
      return readerPort.openReader?.(normalizedJobId, null, `${documentId || ""}`.trim()) !== false;
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
