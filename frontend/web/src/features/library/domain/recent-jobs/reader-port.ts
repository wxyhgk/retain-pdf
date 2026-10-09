import type { ReaderAnchor } from "@/platform/navigation/pages.js";

export function createRecentJobsReaderPort({
  openReader,
}: {
  openReader?: (jobId: string, anchor: ReaderAnchor | null, documentId: string, options: { pinJob?: boolean }) => void;
} = {}) {
  return {
    openReader(jobId: string, anchor: ReaderAnchor | null = null, documentId = "", options: { pinJob?: boolean } = {}) {
      const normalizedJobId = `${jobId || ""}`.trim();
      if (!normalizedJobId) {
        return false;
      }
      openReader?.(normalizedJobId, anchor, `${documentId || ""}`.trim(), options);
      return true;
    },
  };
}
