// 「进度」页的参数类型。拼装见 ../processing-tab-props.ts，展示见 BookDetailProcessingTab。

import type { ReactNode } from "react";
import type { DocumentJobSummary } from "@/features/library/domain.js";
import type { TranslationCoverageView } from "@/platform/api/index.js";
import type { BookTranslationWorkflowPanelProps } from "../panels/translate/WorkflowPanel.jsx";

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
>;

export type BookDetailProcessingTabProps = {
  ocr: BookDetailOcrPanelProps;
  translation: BookDetailTranslationPanelProps;
  loading?: boolean;
  error?: string;
  resultActionsSlot?: ReactNode;
  coverage?: TranslationCoverageView | null;
};
