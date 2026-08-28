// Hộp thoại chi tiết: hợp nhất payload + dòng live thư viện. Dùng chung
// isPollingBootstrapPlaceholder của status/merge-snapshot-with-fallback, tránh
// khung đầu startPolling đè sách đã hoàn thành thành "đang xếp hàng".

import { useMemo } from "react";
import { useStoreSnapshot } from "../../../../../shared/react/use-store.js";
import { isPollingBootstrapPlaceholder } from "../../status/merge-snapshot-with-fallback.js";

/**
 * @param {object} services useHomeServices()
 * @param {object} payloadItem dialogStore.payload
 */
export function useBookDetailLiveItem(services: any, payloadItem: any = {}) {
  const recentJobs = useStoreSnapshot(services.library.recentJobsStore);

  return useMemo(() => {
    const documentId = `${payloadItem.document_id || ""}`.trim();
    const jobId = `${payloadItem.job_id || ""}`.trim();
    const list = Array.isArray(recentJobs?.items) ? recentJobs.items : [];
    let live = null;
    if (documentId) {
      live = list.find((row) => `${row.document_id || ""}`.trim() === documentId) || null;
    }
    if (!live && jobId) {
      live = list.find((row) => `${row.job_id || ""}`.trim() === jobId) || null;
    }
    if (!live) return payloadItem;

    const payloadStatus = `${payloadItem.status || ""}`.trim();
    if (
      isPollingBootstrapPlaceholder(live)
      && (payloadStatus === "succeeded" || payloadStatus === "failed")
    ) {
      return {
        ...live,
        ...payloadItem,
        document_id: live.document_id || payloadItem.document_id,
        library_only: live.library_only ?? payloadItem.library_only,
        status: payloadStatus,
      };
    }
    return live;
  }, [payloadItem, recentJobs]);
}
