// 「进度」页的 ocr / translation 两组参数：从弹窗里各个 hook 的结果拼出来。
//
// 以前这六十多行写在 BookDetailDialog 的 JSX 里，现场拼两个大对象交给类型为 any 的
// BookDetailProcessingTab —— 字段名拼错、漏传，编译器都不会说。现在两边都有类型
// （BookDetailProcessingTabProps），拼装是纯函数，可以单独测。

import type { LibraryCardItem } from "@/features/library/domain.js";
import type {
  BookDetailOcrPanelProps,
  BookDetailTranslationPanelProps,
} from "./tabs/processing-tab-types.js";
import type { useDocumentJobs } from "./use-document-jobs.js";
import type { useBookDetailOcr } from "./use-book-detail-ocr.js";
import type { useBookDetailTranslate } from "./use-book-detail-translate.js";
import type { useBookDetailStageActions } from "./use-book-detail-stage-actions.js";
import type { BookDetailResumeState } from "./use-book-detail-resume.js";
import { canStartTranslation } from "./use-book-detail-cover.js";

export type ProcessingTabPropsInput = {
  open: boolean;
  activeTab: string;
  item: LibraryCardItem;
  pageCount?: number;
  busy?: string;
  error?: string;
  documentJobs: ReturnType<typeof useDocumentJobs>;
  ocrState: ReturnType<typeof useBookDetailOcr>;
  translateState: ReturnType<typeof useBookDetailTranslate>;
  stageActionState: ReturnType<typeof useBookDetailStageActions>;
  resumeState?: BookDetailResumeState;
  translationStatus: { label: string; tone: string };
  translationActive: boolean;
  translationSucceeded: boolean;
  /** 封面推出来的「还能不能翻译」，这里再叠加任务状态和 OCR 待定。 */
  canTranslate: boolean;
  readerAvailable: boolean;
  documentJobIds: string[];
  onOpenLiveReader: (jobId: string) => void;
};

export function buildProcessingTabProps({
  open,
  activeTab,
  item,
  pageCount,
  busy = "",
  error = "",
  documentJobs,
  ocrState,
  translateState,
  stageActionState,
  resumeState,
  translationStatus,
  translationActive,
  translationSucceeded,
  canTranslate,
  readerAvailable,
  documentJobIds,
  onOpenLiveReader,
}: ProcessingTabPropsInput): { ocr: BookDetailOcrPanelProps; translation: BookDetailTranslationPanelProps } {
  const latestTranslation = documentJobs.latestTranslation;
  // 还没翻译过时也给一个「空任务」，让下游统一按没有 job_id 处理。
  const translationItem: LibraryCardItem = latestTranslation
    ? { ...item, ...latestTranslation, library_only: false }
    : {
        ...item,
        job_id: "",
        active_job_id: "",
        workflow: "",
        job_type: "",
        status: "",
        library_only: true,
      };
  const reusableOcr = documentJobs.reusableOcr;

  return {
    ocr: {
      job: documentJobs.ocrStatusJob,
      rangeOn: ocrState.rangeOn,
      pageSpec: ocrState.pageSpec,
      pageCount,
      pending: ocrState.pending,
      cancelling: ocrState.cancelling,
      error: ocrState.error,
      onRangeOnChange: ocrState.setRangeOn,
      onPageSpecChange: ocrState.setPageSpec,
      onOcr: ocrState.handleOcr,
      onCancel: ocrState.handleCancel,
    },
    translation: {
      item: translationItem,
      status: translationStatus,
      isActive: translationActive,
      // OCR 提交待定期间不能同时发起翻译，避免两份任务并发。
      canTranslate: canStartTranslation({
        latestTranslation,
        translationActive,
        baseCanTranslate: canTranslate,
      }) && !ocrState.pending,
      readerAvailable: translationSucceeded || readerAvailable,
      dialogOpen: open,
      tabActive: activeTab === "processing",
      rangeOn: translateState.rangeOn,
      pageSpec: translateState.pageSpec,
      pageCount,
      busy,
      error,
      stageActions: stageActionState.stageActions,
      stageActionsLoading: stageActionState.loading,
      stageActionPending: stageActionState.pendingStage,
      stageActionError: stageActionState.error,
      ocrReuse: reusableOcr ? { jobId: `${reusableOcr.job_id || reusableOcr.id || ""}` } : null,
      onRangeOnChange: translateState.setRangeOn,
      onPageSpecChange: translateState.setPageSpec,
      onTranslate: async () => {
        await translateState.handleTranslate();
      },
      documentJobIds,
      onOpenLiveReader,
      onRetryStage: stageActionState.retry,
      resume: resumeState,
    },
  };
}
