export function createRecentJobsReaderPort({
  openReader,
}: {
  openReader?: (jobId: string, anchor: unknown, documentId: string, options: { pinJob?: boolean }) => void;
} = {}) {
  return {
    openReader(jobId: string, anchor: unknown = null, documentId = "", options: { pinJob?: boolean } = {}) {
      const normalizedJobId = `${jobId || ""}`.trim();
      if (!normalizedJobId) {
        return false;
      }
      openReader?.(normalizedJobId, anchor, `${documentId || ""}`.trim(), options);
      return true;
    },
  };
}
