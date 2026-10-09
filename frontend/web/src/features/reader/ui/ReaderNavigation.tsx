// 阅读入口：把 openReaderRequested / 深链 转成导航。
//
// 默认走 soft open（navigate-to-reader → SoftReaderHost 全屏层），主页不卸载；
// 深链 replace 仍硬进 reader.html。

import { useEffect } from "react";
import { useAppEvent } from "@/ui/hooks/use-app-event.js";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";
import {
  buildReaderDocumentPageUrl,
  buildReaderPageUrl,
  requestedReaderJobIdFromLocation,
} from "../domain/dialog/routing.js";
import { navigateToReader } from "../domain/navigate-to-reader.js";
import { handoffSoftReaderJob } from "@/platform/navigation/soft-reader.js";
import { fetchDocumentReading } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { resolveReadingJobId, type FetchReading } from "../domain/resolve-reading-target.js";

/** openReaderRequested 事件 detail 中本组件读取的字段（来源为事件派发方，未收窄前按 unknown 处理）。 */
function anchorFromEventDetail(detail: { pageIdx?: unknown; blockId?: unknown } = {}) {
  const rawPageIdx = detail.pageIdx;
  const pageIdx = rawPageIdx === null || rawPageIdx === undefined ? NaN : Number(rawPageIdx);
  const blockId = `${detail.blockId || ""}`.trim();
  if (!Number.isFinite(pageIdx) && !blockId) {
    return null;
  }
  return {
    pageIdx: Number.isFinite(pageIdx) ? pageIdx : null,
    blockId,
  };
}

/**
 * 无 UI 的导航组件：只负责把「打开阅读」事件 / 深链 转成跳转 reader.html。
 * 注：domain/dialog 下的 ReaderDialog*Port 是阅读会话端口命名，保留不改。
 */
const fetchReadingFromApi: FetchReading = (documentId) => fetchDocumentReading(API_PREFIX, documentId);

export function ReaderNavigation({ fetchReading = fetchReadingFromApi }: { fetchReading?: FetchReading } = {}) {
  useAppEvent(APP_EVENTS.openReaderRequested, async (event) => {
    const detail = event?.detail || {};
    const documentId = `${detail.documentId || ""}`.trim();
    const anchor = anchorFromEventDetail(detail);
    // 一本书可能翻译过好几次、每次只翻几页：先问后端该打开哪个任务（整本的那个，或
    // 合并结果），再进阅读器。带锚点的跳转、点名某个任务（pinJob）和接口失败都用
    // 调用方给的 job_id。
    const jobId = await resolveReadingJobId(
      { jobId: `${detail.jobId || ""}`.trim(), documentId, anchor, pinJob: detail.pinJob === true },
      fetchReading,
    );
    // A real job is the canonical Reader session: live translation, Markdown,
    // AI context and immutable artifacts all key off job_id. document_id is
    // reserved for source-only library entries that have no job yet.
    if (jobId) {
      const url = buildReaderPageUrl(jobId, anchor);
      navigateToReader(url);
      return;
    }
    if (documentId) {
      const url = buildReaderDocumentPageUrl(documentId, anchor);
      navigateToReader(url);
      return;
    }
    return;
  });

  // retry-stage 会创建新的不可变 job。libraryJobUpdated 同时是当前文档
  // active_job 的乐观真值；Reader 只在自己正展示旧 job/同一 document 时
  // 接管新 job，避免重试另一本书时误切当前阅读内容。
  useAppEvent(APP_EVENTS.libraryJobUpdated, (event) => {
    const job = event?.detail?.job || {};
    const nextJobId = `${job.job_id || job.active_job_id || ""}`.trim();
    const previousJobId = `${job.source_job_id || ""}`.trim();
    if (!nextJobId || !previousJobId || nextJobId === previousJobId) return;
    handoffSoftReaderJob({
      previousJobId,
      nextJobId,
      documentId: `${job.document_id || ""}`.trim(),
    });
  });

  // 主页深链 ?view=reader&job_id= → 直接进阅读页（replace，避免返回死循环）
  useEffect(() => {
    const startupJobId = requestedReaderJobIdFromLocation();
    if (!startupJobId) {
      return;
    }
    const url = buildReaderPageUrl(startupJobId, null);
    navigateToReader(url, { replace: true });
  }, []);

  return null;
}
