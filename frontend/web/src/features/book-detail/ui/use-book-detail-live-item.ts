// 详情弹窗：payload + 书架 live 行合并。
// 与 status/merge-snapshot-with-fallback 共用 isPollingBootstrapPlaceholder，
// 避免 startPolling 首帧把已完成书盖成「排队中」。

import { useMemo } from "react";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { isPollingBootstrapPlaceholder } from "@/features/jobs/index.js";

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
    const payloadWorkflow = `${payloadItem.workflow || payloadItem.job_type || ""}`.trim();
    const liveWorkflow = `${live.workflow || live.job_type || ""}`.trim();
    const liveJobId = `${live.job_id || live.active_job_id || ""}`.trim();
    // 详情内刚提交 retry 时，payload 已经是新 job B，但 recentJobs 事件可能
    // 还停留在旧 job A。此时 document_id 命中不能反过来用 A 覆盖 B；
    // payload 是这次用户动作的直接回执，应保留其任务身份和运行状态。
    if (jobId && liveJobId && liveJobId !== jobId) {
      return {
        ...live,
        ...payloadItem,
        document_id: payloadItem.document_id || live.document_id,
        library_only: payloadItem.library_only ?? live.library_only,
      };
    }
    // job_id 标识一次不可变的任务提交；列表刷新只能更新其运行状态，不能把
    // OCR 任务改写成翻译任务。若后端确实创建了新任务，它必须带新的 job_id。
    if (
      jobId
      && liveJobId === jobId
      && payloadWorkflow
      && liveWorkflow
      && liveWorkflow !== payloadWorkflow
    ) {
      return {
        ...live,
        ...payloadItem,
        document_id: live.document_id || payloadItem.document_id,
        library_only: live.library_only ?? payloadItem.library_only,
      };
    }
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
