// 详情「翻译」Tab：页码范围 + 发起翻译 + 静默 attachJobProgress。
// 进度只在 bd-job-status-inner，不打开工作流弹窗。

import { usePageRange } from "./use-page-range.js";
import {
  reusableOcrJobId,
} from "@/features/library/domain.js";
import type {
  DocumentJobSummary,
  JobSubmissionView,
  OcrDocumentPayload,
  TranslateDocumentPayload,
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
}: {
  open: boolean;
  documentId: string;
  pageCount?: number | null;
  actions: {
    submitDocument: (
      documentId?: string | null,
      payload?: TranslateDocumentPayload | OcrDocumentPayload,
    ) => Promise<JobSubmissionView | null>;
  };
  withBusy: (key: string, fn: () => Promise<void>, fail: string) => Promise<void>;
  setError: (message: string) => void;
  onTranslateStarted?: () => void;
  onJobSubmitted?: (job: Partial<DocumentJobSummary>) => unknown;
  reusableOcrJob?: DocumentJobSummary | null;
}) {
  const {
    rangeOn,
    pageSpec,
    setRangeOn,
    setPageSpec,
    validateRange,
  } = usePageRange({ open, documentId, pageCount });

  async function handleTranslate() {
    const payload: TranslateDocumentPayload = {};
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
      if (artifactJobId) {
        // 复用已有 OCR：不裁页，artifact 里是整本的 OCR JSON，
        // 所以这里给的是**原文 1 基页号**，由 ocr_artifact_reuse.rs 按页号挑页。
        // 混合范围、或超出这份 OCR 覆盖的页，后端按连续段拆成几个任务（library/translate_plan.rs）：
        // 有 OCR 整段覆盖的复用它，没有的那段重新 OCR。回包里 sibling_job_ids 是拆出来的其余任务。
        payload.translation = { page_ranges: checked.pages };
      } else {
        // 无可复用 OCR：ocr.page_ranges 会让 runner 先把 PDF 裁成子集
        // （ocr_flow/transport.rs 的 prepare_uploaded_source_pdf），
        // 于是 OCR JSON 里只剩选中的那 e-s+1 页。翻译阶段要做的是把这份
        // 裁后 JSON **整个**翻完，因此不能再传选页参数。
        //
        // 此前这里传了 `start_page: s, end_page: e`，但 translation 的
        // start/end 是 execution_plan.py:60 交给 resolve_page_range 的
        // **0 基下标**、且基准是裁后的 JSON，与用户输入的 1 基原文页号
        // 不是同一套坐标：选 3-5 → 裁成 3 页 → resolve(3,3,5) 直接抛
        // "Invalid page range"；选 5-12 → 裁成 8 页 → 只翻到原文 10-12 页，
        // 前 5 页被静默吞掉。省略这两个字段即取默认 0 / -1（-1 表示到末页），
        // 语义正是"全部翻完"，与主上传弹窗的做法一致。
        payload.ocr = { page_ranges: checked.spec };
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
    pageSpec,
    setRangeOn,
    setPageSpec,
    handleTranslate,
  };
}
