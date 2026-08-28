// BookDetailDialog —— Đồ chứa:：Kết hợp:  hooks + shell/tabs。
// Trạng thái doanh nghiệp được hiển thị trong use-book-detail-*.js；UI thấy shell / tabs / panels。

import { useEffect, useState } from "react";
import { useHomeServices } from "../../../home-services-context.js";
import { useDialogState } from "../../../state/use-dialog-state.js";
import { useDialogReturnFocus } from "../../../../../shared/react/use-dialog-return-focus.js";
import { useRecentJobCover } from "../display/useRecentJobCover.js";
import { BookDetailShell } from "./shell/BookDetailShell.jsx";
import { CoverActionsPanel } from "./panels/CoverActionsPanel.jsx";
import {
  BookDetailRightTabs,
  BookDetailOverviewTab,
  BookDetailTranslateTab,
  BookDetailMoreTab,
} from "./tabs/index.js";
import { useBookDetailLiveItem } from "./use-book-detail-live-item.js";
import { useBookDetailDocument } from "./use-book-detail-document.js";
import { useBookDetailTranslate } from "./use-book-detail-translate.js";
import { isLibraryCardProcessing } from "../display/library-card-badge.js";
import { useStoreSnapshot } from "../../../../../shared/react/use-store.js";
import {
  isRecentJobActive,
  recentJobStageLabel,
  recentJobStatusLabel,
  isLibraryOnlyItem,
} from "../../../composition/external.js";

function statusOf(item) {
  if (isLibraryOnlyItem(item)) return { label: "Chưa dịch", tone: "muted" };
  if (isRecentJobActive(item)) return { label: recentJobStageLabel(item), tone: "active" };
  const status = `${item.status || ""}`.trim();
  if (status === "succeeded") return { label: "Hoàn thành", tone: "done" };
  if (status === "failed") return { label: "Thất bại", tone: "failed" };
  return { label: recentJobStatusLabel(status), tone: "muted" };
}

export function BookDetailDialog() {
  const services = useHomeServices();
  const { dialogStore } = services.bookDetail;
  const actions = services.library.actions;
  const collectionsCtl = services.collections?.controller;
  const collectionsReload = services.collections?.reloadSignal;
  const dialogState: any = useDialogState(dialogStore);
  const open = Boolean(dialogState.open);
  const payloadItem: any = dialogState.payload || {};
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  const item = useBookDetailLiveItem(services, payloadItem);
  const statusCardState = useStoreSnapshot(services.statusCard.store);
  const cardStatus = `${statusCardState?.snapshot?.status || ""}`.trim().toLowerCase();
  const cardJobId = `${statusCardState?.snapshot?.jobId || ""}`.trim();
  const documentId = `${item.document_id || ""}`.trim();
  const jobId = `${item.job_id || item.active_job_id || cardJobId || ""}`.trim();
  const libraryOnly = isLibraryOnlyItem(item);
  const status = statusOf(item);
  const coverUrl = useRecentJobCover(item);
  const readerAvailable = `${item.status || ""}`.trim() === "succeeded"
    && !["running", "queued", "pending"].includes(cardStatus);
  const canTranslate = libraryOnly || `${item.status || ""}`.trim() === "failed";
  const isActive = isRecentJobActive(item)
    || ["running", "queued", "pending"].includes(cardStatus);
  // Vòng tròn che phủ：Tủ sách live đi + statusCard Đang chạy（Sau khi thử lại payload Có lẽ vẫn như cũ succeeded）
  const coverProcessing = isActive
    || isLibraryCardProcessing(item)
    || (Boolean(cardJobId) && ["running", "queued", "pending"].includes(cardStatus));

  // điểm「Dịch toàn bộ bản sao」/ Các tác vụ đang hoạt động đã chọn dạng lưới：Bản dịch bắt buộc Tab，Tiến độ vào bd-job-status-inner
  const [preferTranslateTab, setPreferTranslateTab] = useState(false);
  useEffect(() => {
    if (!open) {
      setPreferTranslateTab(false);
      return;
    }
    if (payloadItem?.prefer_translate_tab) {
      setPreferTranslateTab(true);
    }
  }, [open, documentId, payloadItem?.prefer_translate_tab]);

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

  const translateState = useBookDetailTranslate({
    open,
    documentId,
    pageCount: docState.pageCount,
    actions,
    withBusy: docState.withBusy,
    setError: docState.setError,
    onTranslateStarted: () => setPreferTranslateTab(true),
  });

  const handleOpenChange = (next) => {
    if (!next) close();
  };

  const defaultTab = (
    preferTranslateTab
    || readerAvailable
    || isActive
    || `${item.status || ""}`.trim() === "failed"
  ) ? "translate" : "overview";

  return (
    <BookDetailShell
      open={open}
      onOpenChange={handleOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      left={(
        <CoverActionsPanel
          coverUrl={coverUrl}
          readerAvailable={readerAvailable}
          documentId={documentId}
          busy={docState.busy}
          processing={coverProcessing}
          onCompare={() => {
            actions.openJobReader(jobId);
            close();
          }}
          onReadSource={() => {
            actions.openSourceReader(documentId);
            close();
          }}
        />
      )}
      right={(
        <BookDetailRightTabs
          open={open}
          resetKey={documentId}
          defaultTab={defaultTab}
          overviewTab={(
            <BookDetailOverviewTab
              pageCount={docState.pageCount}
              bytes={docState.doc?.bytes}
              addedAt={docState.doc?.added_at}
              memberCollections={docState.memberCollections}
              editing={docState.editing}
              titleText={docState.titleText}
              tagsText={docState.tagsText}
              tags={docState.tags}
              authors={docState.authors}
              year={docState.doc?.year}
              displayTitle={docState.doc?.title || docState.titleText}
              busy={docState.busy}
              onStartEdit={docState.startEdit}
              onCancelEdit={() => docState.setEditing(false)}
              onSave={docState.handleSaveEdit}
              onTitleChange={docState.setTitleText}
              onTagsTextChange={docState.setTagsText}
            />
          )}
          translateTab={({ activeTab }) => (
            <BookDetailTranslateTab
              item={item}
              status={status}
              isActive={isActive}
              canTranslate={canTranslate}
              readerAvailable={readerAvailable}
              dialogOpen={open}
              tabActive={activeTab === "translate"}
              rangeOn={translateState.rangeOn}
              startPage={translateState.startPage}
              endPage={translateState.endPage}
              pageCount={docState.pageCount}
              busy={docState.busy}
              error={docState.error}
              onRangeOnChange={translateState.setRangeOn}
              onStartPageChange={translateState.setStartPage}
              onEndPageChange={translateState.setEndPage}
              onTranslate={translateState.handleTranslate}
            />
          )}
          moreTab={(
            <BookDetailMoreTab
              readingStatus={docState.readingStatus}
              busy={docState.busy}
              onReadingStatusChange={docState.handleReadingStatus}
              collections={docState.collections}
              collectionsBusy={docState.collectionsBusy}
              onToggleCollection={docState.toggleCollection}
              error={docState.error}
              confirmingDelete={docState.confirmingDelete}
              onDelete={docState.handleDelete}
            />
          )}
        />
      )}
    />
  );
}
