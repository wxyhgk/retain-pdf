/** 阅读页「改译文」用的后端能力（包里的 ReaderTranslationEditPort）：读一段译文、写回、修订记录、原地重新排版。 */
import type { ReaderTranslationEditPort } from "@retainpdf/reader/contracts";
import {
  fetchJobData,
  fetchJobPayload,
  fetchTranslationItem,
  retryJobStage,
  reviseTranslationItem,
} from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { resolveTranslationOwnerId } from "@/features/jobs/index.js";

export const translationEditPort: ReaderTranslationEditPort = {
  // 重新排版出来的任务没有自己的译文，顺着 source_artifact_job_id 找到持有译文的那个（和书详情的重新处理同一条路）。
  resolveOwnerJobId: (jobId) => resolveTranslationOwnerId(jobId, (id) => fetchJobPayload(id, { apiPrefix: API_PREFIX })),
  loadItem: (jobId, itemId) => fetchTranslationItem(jobId, itemId, API_PREFIX),
  revise: (jobId, itemId, body) => reviseTranslationItem(jobId, itemId, body, API_PREFIX),
  // 通用取数接口按阅读页块号筛（后端把三位、四位写法归成同一个）。
  fetchRevisions: (jobId, readerItemId) => fetchJobData(jobId, API_PREFIX, "revisions", readerItemId
    ? { filters: { item_id: readerItemId }, sort: "ts", limit: 200 }
    : { sort: "-ts", limit: 500 }),
  rerender: (jobId) => retryJobStage(jobId, API_PREFIX, "render", { create_new_job: false }),
};
