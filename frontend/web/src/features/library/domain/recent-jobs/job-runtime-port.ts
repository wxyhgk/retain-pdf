export function createRecentJobsRuntimePort({
  openJob,
  /** 冷启动恢复活跃任务：默认 silent，不抬工作流区 */
  recoverJob,
  currentJobId = () => "",
}: {
  openJob?: (jobId: string) => void;
  recoverJob?: (jobId: string) => void;
  currentJobId?: () => string;
} = {}) {
  function normalizeAndRun(handler: ((jobId: string) => void) | undefined, jobId: unknown) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
      return false;
    }
    handler?.(normalizedJobId);
    return true;
  }

  return {
    currentJobId() {
      return `${currentJobId?.() || ""}`.trim();
    },

    openJob(jobId: unknown) {
      return normalizeAndRun(openJob, jobId);
    },

    recoverJob(jobId: unknown) {
      const handler = recoverJob || openJob;
      return normalizeAndRun(handler, jobId);
    },
  };
}
