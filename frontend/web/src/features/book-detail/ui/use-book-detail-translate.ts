// 详情「翻译」Tab：页码范围 + 发起翻译 + 静默 attachJobProgress。
// 进度只在 bd-job-status-inner，不打开工作流弹窗。

import { usePageRange } from "./use-page-range.js";
import {
  inclusivePageNumbers,
  reusableOcrJobId,
} from "@/features/library/domain.js";

/**
 * @param {object} options
 * @param {boolean} options.open
 * @param {string} options.documentId
 * @param {number} options.pageCount
 * @param {object} options.actions library.actions（含 attachJobProgress / translateDocument）
 * @param {(key: string, fn: Function, fail: string) => Promise<void>} options.withBusy
 * @param {(msg: string) => void} options.setError
 * @param {() => void} [options.onTranslateStarted] 成功提交后切到处理 Tab 等
 * @param {(job: object) => void} [options.onJobSubmitted] 立即写入文档任务状态
 */
export function useBookDetailTranslate({
  open,
  documentId,
  pageCount,
  actions,
  withBusy,
  setError,
  onTranslateStarted,
  onJobSubmitted,
  reusableOcrJob,
}: any) {
  const {
    rangeOn,
    startPage,
    endPage,
    setRangeOn,
    setStartPage,
    setEndPage,
    validateRange,
  } = usePageRange({ open, documentId, pageCount });

  async function handleTranslate() {
    const payload: any = {};
    const artifactJobId = reusableOcrJobId(reusableOcrJob);
    if (artifactJobId) {
      payload.workflow = "translate";
      payload.source = { artifact_job_id: artifactJobId };
      payload.translation = { page_ranges: [] };
    }
    if (rangeOn) {
      const checked = validateRange();
      if (!checked.valid) {
        setError(checked.error);
        return;
      }
      const { s, e } = checked as { s: number; e: number };
      if (artifactJobId) {
        payload.translation = { page_ranges: inclusivePageNumbers(s, e) };
      } else {
        payload.ocr = { page_ranges: `${s}-${e}` };
        payload.translation = { start_page: s, end_page: e };
      }
    }
    // 先切到处理 Tab，保证 bd-job-status-inner 在视口内再接进度
    onTranslateStarted?.();
    await withBusy(
      "translate",
      async () => {
        // promoteDocumentToJob：改详情 payload + silent attachJobProgress
        // 不 openTranslationWorkflow
        const result = await actions.submitDocument(documentId, payload);
        if (result) {
          onJobSubmitted?.({
            ...result,
            document_id: result.document_id || documentId,
            workflow: result.workflow || payload.workflow || "book",
          });
        }
        onTranslateStarted?.();
      },
      "发起翻译失败",
    );
  }

  return {
    rangeOn,
    startPage,
    endPage,
    setRangeOn,
    setStartPage,
    setEndPage,
    handleTranslate,
  };
}
