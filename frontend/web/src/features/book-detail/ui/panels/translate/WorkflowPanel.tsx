// 书籍详情「翻译」Tab 的工作流主面板。
//
// 从 IngestDialog 的内容区迁移而来：
//   - 弹窗里：#status-section + StatusCardMain（#job-status-card）
//   - 本 Tab：#book-detail-status-section + StatusCardEmbedded（#book-detail-job-status-card）
//
// 书已在馆：不需要 WorkflowPanel 上传表单；发起翻译用 BookTranslateLaunchForm。
// 进度主场永远在本面板，绝不打开 #translation-workflow-dialog。

import type { ReactNode } from "react";
import { BookTranslateProgressPanel } from "./TranslateProgress.jsx";
import { BookTranslateLaunchForm } from "./TranslateForm.jsx";
import { TranslationStageActions } from "./TranslationStageActions.jsx";
import type { LibraryCardItem } from "@/features/library/domain.js";
import type { JobRetryStage, JobStageRetryActionView } from "@/platform/api/index.js";

export type BookTranslationWorkflowPanelProps = {
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
  /** 与「翻译整本」同排的动作（例如「开始/重新 OCR」）。 */
  ocrActionSlot?: ReactNode;
  /** 与翻译「指定页码」同一选项行的 OCR 选项（「OCR 指定页码」）。 */
  ocrOptionsSlot?: ReactNode;
  onRangeOnChange: (value: boolean) => void;
  onPageSpecChange: (value: string) => void;
  onTranslate: () => void;
  onOpenLiveReader?: (jobId: string) => void;
  /** 本书的任务 id，透传给进度区：全局状态卡的任务不属于本书时不跟它。 */
  documentJobIds?: string[];
  onRetryStage: (
    stage: JobRetryStage,
    options?: { acceptDuplicateRisk?: boolean; renderEngine?: string },
  ) => Promise<unknown>;
};

/**
 * 对应旧弹窗 translation-workflow-shell 中的 status + 动作区，
 * 布局适配详情右栏 Tab。
 */
export function BookTranslationWorkflowPanel({
  item = {},
  status,
  canTranslate,
  readerAvailable = false,
  isActive = false,
  tabActive = true,
  dialogOpen = true,
  rangeOn,
  pageSpec,
  pageCount,
  busy = "",
  error = "",
  stageActions = [],
  stageActionsLoading = false,
  stageActionPending = "",
  stageActionError = "",
  ocrReuse = null,
  ocrActionSlot = null,
  ocrOptionsSlot = null,
  onRangeOnChange,
  onPageSpecChange,
  onTranslate,
  onOpenLiveReader,
  documentJobIds = [],
  onRetryStage,
}: BookTranslationWorkflowPanelProps) {
  const jobId = `${item.job_id || item.active_job_id || ""}`.trim();
  const hasRealJob = Boolean(jobId) && !jobId.startsWith("doc:");
  // 提交中（busy==="translate"）或阶段重试待定：job 回执尚未落袋，
  // 状态区先行占位，进度一到即在区内展开，不闪现、不另弹工作流窗。
  const submitting = busy === "translate" || Boolean(stageActionPending);
  const showStatus = isActive || status.tone === "failed" || submitting;
  // 黑主按钮只留进度区内的「查看实时译文」，此处两颗均为 btn("outline")。
  const stageActionsNode =
    hasRealJob && !isActive ? (
      <TranslationStageActions
        actions={stageActions}
        loading={stageActionsLoading}
        pendingStage={stageActionPending}
        error={stageActionError}
        onRetry={onRetryStage}
      />
    ) : null;

  return (
    <div
      className="book-translation-workflow space-y-3"
      data-book-translation-workflow="true"
    >
      {/* 取消任务只降视觉为文字链：作用域样式覆盖，不动 StatusCardEmbedded 事件/回调/disabled。 */}
      <style>{`#book-detail-status-section .bd-job-status-btn-cancel{border-color:transparent;background:transparent;box-shadow:none;padding-left:4px;padding-right:4px;text-decoration:underline;text-underline-offset:2px}#book-detail-status-section .bd-job-status-btn-cancel:hover:not(:disabled){background:transparent;color:inherit}#book-detail-status-section .bd-job-status-btn-primary{background:transparent;color:var(--ink)}`}</style>
      {showStatus ? (
        <section
          id="book-detail-status-section"
          className="book-translation-status-panel"
          aria-label="任务进度"
        >
          <BookTranslateProgressPanel
            item={item}
            active={tabActive}
            dialogOpen={dialogOpen}
            onOpenLiveReader={isActive ? onOpenLiveReader : undefined}
            documentJobIds={documentJobIds}
          />
        </section>
      ) : null}

      {/* 唯一的动作区：一行选项（翻译 / OCR 指定页码）+ 一行按钮（重新翻译、重新渲染、
          OCR、翻译整本）。以前这些散在三处：阶段重试一行、OCR 按钮另一行、OCR 页码
          单独一张卡。 */}
      <BookTranslateLaunchForm
        canTranslate={canTranslate}
        readerAvailable={readerAvailable}
        isActive={isActive}
        statusTone={status.tone}
        rangeOn={rangeOn}
        pageSpec={pageSpec}
        pageCount={pageCount}
        busy={busy}
        error={error}
        ocrReuse={ocrReuse}
        extraActions={ocrActionSlot}
        leadingActions={stageActionsNode}
        extraOptions={ocrOptionsSlot}
        onRangeOnChange={onRangeOnChange}
        onPageSpecChange={onPageSpecChange}
        onTranslate={onTranslate}
      />
      {isActive ? (
        <p className="text-[11px] text-muted-foreground">实时译文随 OCR 逐页可见，无需等待全部完成。</p>
      ) : null}
    </div>
  );
}
