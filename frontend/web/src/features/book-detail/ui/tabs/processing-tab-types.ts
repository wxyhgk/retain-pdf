// 「进度」页的参数类型。拼装见 ../processing-tab-props.ts，展示见 BookDetailProcessingTab。
import type { BookDetailCaches } from "../../domain/book-detail-caches.js";

import type { ReactNode } from "react";
import type { DocumentJobSummary } from "@/features/library/domain.js";
import type { TranslationCoverageView } from "@/platform/api/index.js";
import type { BookTranslationWorkflowPanelProps } from "../panels/translate/WorkflowPanel.jsx";
import type { BookDetailResumeState } from "../use-book-detail-resume.js";

/** 读进度时只看这几个字段；任务摘要和实时快照都长这样。 */
export type ProgressSource = {
  progress?: unknown;
  stage?: string;
  stage_detail?: string;
  stage_snapshot?: {
    progress?: unknown;
    stage?: string;
    display_stage?: string;
    stage_detail?: string;
  } | null;
} | null | undefined;

/** 「进度」页 OCR 段要的东西，由 useBookDetailProcessingProps 拼好。 */
export type BookDetailOcrPanelProps = {
  job: DocumentJobSummary | null;
  rangeOn: boolean;
  pageSpec: string;
  pageCount?: number;
  pending: boolean;
  cancelling: boolean;
  error: string;
  onRangeOnChange: (value: boolean) => void;
  onPageSpecChange: (value: string) => void;
  onOcr: () => void;
  onCancel: (jobId: string) => void;
};

/** 翻译段原样交给 BookTranslationWorkflowPanel；两个 OCR 插槽和收起开关由本页自己决定。 */
export type BookDetailTranslationPanelProps = Omit<
  BookTranslationWorkflowPanelProps,
  "ocrActionSlot" | "ocrOptionsSlot" | "hideStageActions"
> & {
  /** 失败 / 取消的翻译任务：续跑计划与「从断点继续」。 */
  resume?: BookDetailResumeState;
};

export type BookDetailProcessingTabProps = {
  ocr: BookDetailOcrPanelProps;
  translation: BookDetailTranslationPanelProps;
  loading?: boolean;
  error?: string;
  resultActionsSlot?: ReactNode;
  coverage?: TranslationCoverageView | null;
  /** 编辑部流程图的会话缓存（BookDetailDialog 创建），跑完的任务读一次就记住。 */
  editorialFlowCache?: BookDetailCaches["settledFlows"];
};
