// BookDetailDialog —— 容器：组合 hooks + shell/tabs。
// 业务状态见 use-book-detail-*.js；UI 见 shell / tabs / panels。

import {
  useHomeBookDetail,
  useHomeCollections,
  useHomeJobRuntime,
  useHomeStatusCard,
} from "@/ui/context/home-services-context.js";
import { useDialogState } from "@/ui/hooks/use-dialog-state.js";
import { useDialogReturnFocus } from "@/ui/hooks/use-dialog-return-focus.js";
import { useRecentJobCover, useLibraryServices } from "@/features/library/index.js";
import type { LibraryCardItem } from "@/features/library/index.js";
import { BookUsageCard } from "@/features/usage/index.js";
import { QualityPanel } from "./panels/overview/QualityPanel.jsx";
import { BookDetailShell } from "./shell/BookDetailShell.jsx";
import { CoverActionsPanel } from "./panels/CoverActionsPanel.jsx";
import { ArtifactQuickDownloads } from "./panels/ArtifactQuickDownloads.js";
import { ProcessingResultActions } from "./panels/processing/ProcessingResultActions.jsx";
import {
  BookDetailRightTabs,
  BookDetailOverviewTab,
  BookDetailProcessingTab,
  BookDetailArtifactsTab,
} from "./tabs/index.js";
import { ReadingStatusPanel } from "./panels/more/ReadingStatusPanel.jsx";
import { CollectionsPanel } from "./panels/more/CollectionsPanel.jsx";
import { DeleteFooterPanel } from "./panels/more/DeleteFooterPanel.jsx";
import { useTranslationCoverage } from "./use-translation-coverage.js";
import { useBookDetailLiveItem } from "./use-book-detail-live-item.js";
import { useBookDetailDocument } from "./use-book-detail-document.js";
import { useBookDetailTranslate } from "./use-book-detail-translate.js";
import { useBookDetailOcr } from "./use-book-detail-ocr.js";
import { useBookDetailStageActions } from "./use-book-detail-stage-actions.js";
import { useBookDetailResume } from "./use-book-detail-resume.js";
import {
  documentJobPresentation,
  isDocumentJobActive,
  useDocumentJobs,
} from "./use-document-jobs.js";
import { jobIdOf } from "../domain/document-jobs-model.js";
import { bookDetailHasTranslation, useBookDetailCover } from "./use-book-detail-cover.js";
import { buildProcessingTabProps } from "./processing-tab-props.js";
import { useBookDetailTab } from "./use-book-detail-tab.js";
import { useBookDetailArtifactCenter } from "./use-book-detail-artifact-center.js";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";

export function BookDetailDialog() {
  const { dialogStore } = useHomeBookDetail();
  const library = useLibraryServices();
  const actions = library.actions;
  const collections = useHomeCollections();
  const collectionsCtl = collections?.controller;
  const collectionsReload = collections?.reloadSignal;
  const { store: statusCardStore } = useHomeStatusCard();
  const { store: jobRuntimeStore } = useHomeJobRuntime();
  const dialogState = useDialogState<LibraryCardItem | null>(dialogStore);
  const open = Boolean(dialogState.open);
  const payloadItem: LibraryCardItem = dialogState.payload || {};
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  const item = useBookDetailLiveItem(payloadItem);
  const statusCardState = useStoreSnapshot(statusCardStore);
  const documentId = `${item.document_id || ""}`.trim();
  const coverUrl = useRecentJobCover(item);

  const close = () => dialogStore.close();

  const docState = useBookDetailDocument({
    open,
    documentId,
    item,
    actions,
    collectionsCtl,
    collectionsReload,
    onClose: close,
  });

  const documentJobs = useDocumentJobs({
    open,
    documentId,
    actions,
    initialJob: item,
    runtimeStore: jobRuntimeStore,
    onJobSucceeded: () => {
      void docState.refreshDocument?.();
    },
  });
  const coverage = useTranslationCoverage({ open, documentId, jobs: documentJobs.jobs });
  // 能不能对照阅读看「有没有任何成功的带译文任务」，不看当前任务：重新翻译 / 重新渲染在跑
  // 或失败时旧译文照样能读（阅读器按全部成功任务合并）。coverage 已经拉了，直接用。
  const {
    coverProcessing,
    readPresentation,
    readerAvailable,
    canTranslate,
    isActive,
    cardJobId,
  } =
    useBookDetailCover({ item, statusCardState, hasTranslation: bookDetailHasTranslation({ item, coverage }) });
  const jobId = `${item.job_id || item.active_job_id || cardJobId || ""}`.trim();

  // 点「翻译整本」/ 网格选中活跃任务：强制处理 Tab，进度在 bd-job-status-inner
  const { preferTranslateTab, defaultTab, setPreferTranslateTab } = useBookDetailTab({
    open,
    payloadItem,
    item,
    readerAvailable,
    isActive,
  });
  const translateState = useBookDetailTranslate({
    open,
    documentId,
    pageCount: docState.pageCount,
    actions,
    withBusy: docState.withBusy,
    setError: docState.setError,
    onTranslateStarted: () => setPreferTranslateTab(true),
    onJobSubmitted: documentJobs.upsert,
    reusableOcrJob: documentJobs.reusableOcr,
  });

  const ocrState = useBookDetailOcr({
    open,
    documentId,
    pageCount: docState.pageCount,
    actions,
    onStarted: documentJobs.upsert,
    onCancelled: () => documentJobs.refresh(),
  });
  const latestTranslation = documentJobs.latestTranslation;
  const overviewOcrStatus = documentJobPresentation(documentJobs.ocrStatusJob, "尚未执行");
  const translationActive = isDocumentJobActive(latestTranslation);
  const translationStatus = documentJobPresentation(latestTranslation, "尚未翻译");
  const translationSucceeded = `${latestTranslation?.status || ""}`.toLowerCase() === "succeeded";
  const stageActionState = useBookDetailStageActions({
    open,
    // 不是 latestTranslation：最新的是一次重新渲染时，以最新的翻译为底，见 selectRetryBaseJob。
    job: documentJobs.retryBaseTranslation || latestTranslation,
    actions,
    onJobSubmitted: documentJobs.upsert,
    // OCR 完成可能发生在失败翻译任务之后；此时 translation job_id 不变，
    // 但可重试能力已经变化，必须清除旧 409 并重新读取 stage-actions。
    refreshKey: [
      documentJobs.reusableOcr?.job_id || documentJobs.reusableOcr?.id || "",
      documentJobs.reusableOcr?.status || "",
      documentJobs.reusableOcr?.updated_at || "",
    ].join(":"),
  });
  // 失败 / 取消的最新翻译任务：从断点继续。
  const resumeState = useBookDetailResume({
    open,
    job: latestTranslation,
    onJobSubmitted: documentJobs.upsert,
  });
  const artifactCenter = useBookDetailArtifactCenter({
    active: open,
    documentId,
    refreshRevision: documentJobs.succeededRevision,
    title: docState.doc?.title || item.title || "",
    source: {
      filename: docState.doc?.source_filename || item.source_filename || item.title,
      url: docState.doc?.source_pdf_url || item.source_pdf_url,
      sizeBytes: docState.doc?.bytes ?? item.bytes,
      generatedAt: docState.doc?.added_at || item.added_at || item.created_at,
    },
    jobs: documentJobs.jobs,
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) close();
  };

  const openSource = () => {
    actions.openSourceReader(documentId);
    close();
  };

  // 「点名看某个任务」：产物「查看」、进度页「查看实时译文」。带 pinJob，阅读器原样打开
  // 这个任务，不按整本挑（后端只挑成功的翻译任务——OCR 会被换成翻译、在跑的重翻会被换成
  // 旧译文）。封面「对照阅读」是「看这本书」，不走这里。
  const openPinnedJob = (pinnedJobId: string) => {
    actions.openJobReader(pinnedJobId, documentId, { pinJob: true });
    close();
  };

  // 本书的任务 id。全局 statusCard 只有一张、可能在播另一本书的任务，读它的地方
  // （结果操作行、实时译文入口）只认这里面的。
  const documentJobIds = documentJobs.jobs.map(jobIdOf).filter(Boolean);

  return (
    <BookDetailShell
      open={open}
      onOpenChange={handleOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      title={`${docState.doc?.title || item.title || "文档"}`}
      left={(
        <CoverActionsPanel
          coverUrl={coverUrl}
          title={docState.doc?.title || docState.titleText || item.title}
          authors={docState.authors}
          year={docState.doc?.year || item.year}
          pageCount={docState.pageCount}
          readingStatus={docState.readingStatus}
          readerAvailable={readerAvailable}
          readerActionLabel={readPresentation.label}
          documentId={documentId}
          jobId={jobId}
          busy={docState.busy}
          processing={coverProcessing}
          onCompare={() => {
            actions.openJobReader(readPresentation.jobId || jobId, documentId);
            close();
          }}
          onReadSource={openSource}
          quickDownloadsSlot={(
            <ArtifactQuickDownloads
              sections={artifactCenter.sections}
              loading={artifactCenter.loading}
              downloadingId={artifactCenter.downloadingId}
              onDownload={(artifact) => void artifactCenter.download(artifact)}
            />
          )}
        />
      )}
      right={(
        <BookDetailRightTabs
          open={open}
          resetKey={documentId}
          defaultTab={defaultTab}
          overviewTab={({ selectTab }) => (
            <BookDetailOverviewTab
              pageCount={docState.pageCount}
              bytes={docState.doc?.bytes}
              addedAt={docState.doc?.added_at}
              editing={docState.editing}
              titleText={docState.titleText}
              busy={docState.busy}
              error={docState.error}
              ocrStatus={overviewOcrStatus}
              translationStatus={translationStatus}
              jobs={documentJobs.jobs}
              onOpenProcessing={() => selectTab("processing")}
              onStartEdit={docState.startEdit}
              onCancelEdit={() => docState.setEditing(false)}
              onSave={docState.handleSaveEdit}
              onTitleChange={docState.setTitleText}
              readingSlot={(
                <ReadingStatusPanel
                  value={docState.readingStatus}
                  busy={docState.busy}
                  onChange={docState.handleReadingStatus}
                />
              )}
              collectionsSlot={(
                <CollectionsPanel
                  collections={docState.collections}
                  collectionsBusy={docState.collectionsBusy}
                  onToggle={docState.toggleCollection}
                />
              )}
              usageSlot={documentId ? <BookUsageCard documentId={documentId} /> : null}
              qualitySlot={jobId ? <QualityPanel jobId={jobId} documentId={documentId} /> : null}
              dangerSlot={(
                <DeleteFooterPanel
                  busy={docState.busy}
                  onDelete={docState.handleDelete}
                  title={docState.doc?.title || docState.titleText || item.title}
                />
              )}
            />
          )}
          processingTab={({ activeTab }) => (
            <BookDetailProcessingTab
              loading={documentJobs.loading}
              error={documentJobs.error}
              // 结果操作行读全局 statusCard store，注入点放在这里（对话框本身
              // 长在 HomeShellProviders 内），让「进度」Tab 组件保持纯展示。
              resultActionsSlot={<ProcessingResultActions documentJobIds={documentJobIds} />}
              coverage={coverage}
              {...buildProcessingTabProps({
                open,
                activeTab,
                item,
                pageCount: docState.pageCount,
                busy: docState.busy,
                error: docState.error,
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
                onOpenLiveReader: openPinnedJob,
              })}
            />
          )}
          artifactsTab={() => (
            <BookDetailArtifactsTab
              onOpenSource={openSource}
              artifactCenter={artifactCenter}
              onOpenJob={openPinnedJob}
            />
          )}
        />
      )}
    />
  );
}
