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

function anchorFromEventDetail(detail: any = {}) {
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
 * 无 UI：只负责把「打开阅读」事件 / 深链 转成跳转 reader.html。
 * 组件名保留 ReaderDialog，避免 HomeApp / 测试 import 大面积改动。
 */
export function ReaderDialog() {
  useAppEvent(APP_EVENTS.openReaderRequested, (event) => {
    const detail = event?.detail || {};
    const jobId = `${detail.jobId || ""}`.trim();
    const documentId = `${detail.documentId || ""}`.trim();
    const anchor = anchorFromEventDetail(detail);
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
