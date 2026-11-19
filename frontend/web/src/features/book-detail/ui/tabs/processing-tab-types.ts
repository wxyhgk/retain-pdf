// 「进度」页的参数类型。拼装见 ../processing-tab-props.ts，展示见 BookDetailProcessingTab。

import type { ReactNode } from "react";
import type { DocumentJobSummary, LibraryCardItem } from "@/platform/contracts/library-payloads.js";
import type { TranslationCoverageView } from "@/platform/api/index.js";
import type { JobRetryStage, JobStageRetryActionView } from "@/platform/api/index.js";
import type { BookDetailResumeState } from "../use-book-detail-resume.js";
import type { UsageViewModel } from "@/features/usage/index.js";
import type { UsageEstimateView } from "@/platform/api/index.js";
import type { TranslationConnection } from "@/platform/config/translation-connections.js";

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

/** 翻译段的状态和动作，由 useBookDetailProcessingProps 拼好。 */
export type BookDetailTranslationWorkflowProps = {
  item?: LibraryCardItem;
  status: { label: string; tone: string };
  canTranslate: boolean;
  readerAvailable?: boolean;
  isActive?: boolean;
  tabActive?: boolean;
  dialogOpen?: boolean;
  rangeOn: boolean;
  pageSpec: string;
  pageCount?: number;
  busy?: string;
  error?: string;
  stageActions?: JobStageRetryActionView[];
  stageActionsLoading?: boolean;
  stageActionPending?: JobRetryStage | "";
  stageActionError?: string;
  ocrReuse?: { jobId: string } | null;
  onRangeOnChange: (value: boolean) => void;
  onPageSpecChange: (value: string) => void;
  onTranslate: () => void;
  onOpenLiveReader?: (jobId: string) => void;
  /** 本书的任务 id，透传给状态行的任务动作：全局状态卡的任务不属于本书时不跟它。 */
  documentJobIds?: string[];
  onRetryStage: (
    stage: JobRetryStage,
    options?: {
      acceptDuplicateRisk?: boolean;
      renderEngine?: string;
      translationQuality?: string;
      translationConnection?: TranslationConnection | null;
    },
  ) => Promise<unknown>;
  /** 重新翻译换成这个模型大概要花多少（GET /documents/:id/usage/estimate）；不给就不显示估价。 */
  estimateRetranslate?: (baseUrl: string, model: string) => Promise<UsageEstimateView | null>;
};

export type BookDetailTranslationPanelProps = BookDetailTranslationWorkflowProps & {
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
  /** 这本书的模型用量（ProcessingTabWithUsage 读好给）；没有就不出「用量」。 */
  usage?: { model: UsageViewModel; loading: boolean; error: string; reload: () => void } | null;
};
