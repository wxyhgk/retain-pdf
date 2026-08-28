// Lối vào trình đọc: chuyển openReaderRequested / deep link thành điều hướng.
//
// Mặc định soft open (navigate-to-reader → lớp toàn màn SoftReaderHost), trang chính
// không gỡ; deep link replace vẫn cứng vào reader.html.

import { useEffect } from "react";
import { useAppEvent } from "../../../../shared/react/use-app-event.js";
import {
  APP_EVENTS,
  buildReaderDocumentPageUrl,
  buildReaderPageUrl,
  requestedReaderJobIdFromLocation,
} from "../../composition/external.js";
import { navigateToReader } from "./navigate-to-reader.js";

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
 * Không UI: chỉ chịu trách nhiệm chuyển sự kiện "mở trình đọc" / deep link thành
 * chuyển trang reader.html. Giữ tên ReaderDialog, tránh sửa rộng import của
 * HomeApp / kiểm thử.
 */
export function ReaderDialog() {
  useAppEvent(APP_EVENTS.openReaderRequested, (event) => {
    const detail = event?.detail || {};
    const jobId = `${detail.jobId || ""}`.trim();
    const anchor = anchorFromEventDetail(detail);
    if (jobId) {
      const url = buildReaderPageUrl(jobId, anchor);
      navigateToReader(url);
      return;
    }
    const documentId = `${detail.documentId || ""}`.trim();
    if (!documentId) {
      return;
    }
    const url = buildReaderDocumentPageUrl(documentId, anchor);
    navigateToReader(url);
  });

  // Deep link trang chính ?view=reader&job_id= → vào thẳng trang đọc (replace, tránh
  // vòng lặp quay lại chết)
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
