// 图书馆(文档)域动作集合的装配根。业务按职责拆到 `documents/` 下的独立模块，
// 本文件只负责：建 bookDetailStore、注入依赖、把各模块拼成 LibraryController。
//
// 进度接入契约（与 selectJob 刻意分叉）:
// - selectJob（recent-jobs/actions）→ 打开工作流弹窗 + startPolling
// - attachJobProgress（documents/attach-progress）→ 只 startPolling，不弹窗、
//   不亮主状态区，供书籍详情「翻译」Tab 内嵌 StatusCard 使用。

import { createDialogStore } from "@/platform/store/dialog-store.js";
import type {
  JobSubmissionView,
  LibraryCardItem,
  LibraryController,
  LibraryControllerDeps,
  ReloadRecentJobsOptions,
} from "./types.js";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";
import { createAttachJobProgress } from "./documents/attach-progress.js";
import { promoteDocumentToJob } from "./documents/promote.js";
import { createDocumentSubmitActions } from "./documents/submit-actions.js";
import { createDocumentDeleteActions } from "./documents/delete-actions.js";
import { createDocumentJobActions } from "./documents/job-actions.js";
import { createBookDetailNavigation } from "./documents/navigation-actions.js";
import { createDocumentUpdateAction } from "./documents/update-document.js";

export function createLibraryController({
  documentRef,
  libraryEventPort,
  reloadRecentJobs,
  removeLibraryDocuments,
  patchLibraryDocumentItem,
  deleteJob,
  buildTranslateConfig,
  buildOcrConfig,
  startPolling,
  recentJobsStatePort,
}: LibraryControllerDeps = {}): LibraryController {
  // payload = 被点开的那张网格卡片 item；弹窗再按 document_id 拉完整文档补齐元数据。
  const bookDetailStore = createDialogStore<LibraryCardItem | null>(null);

  function dispatchAppEvent(name: string, detail?: unknown) {
    if (documentRef?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
      documentRef.dispatchEvent(
        new globalThis.CustomEvent(name, detail === undefined ? undefined : { detail }),
      );
    }
  }

  async function reload(opts?: ReloadRecentJobsOptions) {
    await reloadRecentJobs?.(opts);
  }

  // F4 馆藏文档"读原文":无 job,派发带 documentId 的 openReaderRequested。
  function openSourceReader(documentId?: string | null) {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId) {
      return;
    }
    dispatchAppEvent(APP_EVENTS.openReaderRequested, { documentId: normalizedId, pageIdx: null, blockId: "" });
  }

  // F3 "只入库,不翻译":上传完成时后端已建 document，"只入库"就是不提交 job。
  function storeUploadedDocumentOnly() {
    dispatchAppEvent(APP_EVENTS.closeTranslationWorkflow);
  }

  const attachJobProgress = createAttachJobProgress({ startPolling });

  const promote = (
    documentId: string,
    result: JobSubmissionView | null | undefined,
    sourceJobId = "",
  ) => {
    promoteDocumentToJob({
      bookDetailStore,
      libraryEventPort,
      attachJobProgress,
      documentId,
      result,
      sourceJobId,
    });
  };

  const submit = createDocumentSubmitActions({
    buildTranslateConfig,
    buildOcrConfig,
    promoteDocumentToJob: promote,
  });
  const deleteActions = createDocumentDeleteActions({
    removeLibraryDocuments,
    reload,
    deleteJob,
  });
  const jobActions = createDocumentJobActions({
    bookDetailStore,
    buildTranslateConfig,
    promoteDocumentToJob: promote,
  });
  const navigation = createBookDetailNavigation({
    bookDetailStore,
    attachJobProgress,
    recentJobsStatePort,
  });
  const { updateDocument } = createDocumentUpdateAction({
    bookDetailStore,
    patchLibraryDocumentItem,
    reload,
  });

  const controller = {
    bookDetailStore,
    // 键名对齐 services.library.actions 的既有契约(消费方 RecentJobsLibrary /
    // BookDetailDialog / CategoriesView 不用改)。
    openSourceReader,
    storeOnly: storeUploadedDocumentOnly,
    translateDocument: submit.translateDocument,
    ocrDocument: submit.ocrDocument,
    getDocumentJobs: jobActions.getDocumentJobs,
    getDocumentByJobId: jobActions.getDocumentByJobId,
    getJobStageActions: jobActions.getJobStageActions,
    retryJobStage: jobActions.retryJobStage,
    cancelJob: jobActions.cancelJob,
    deleteDocument: deleteActions.deleteDocument,
    deleteDocuments: deleteActions.deleteDocuments,
    deleteCard: deleteActions.deleteCard,
    openBookDetail: navigation.openBookDetail,
    selectJobForDetail: navigation.selectJobForDetail,
    selectJob: navigation.selectJob,
    updateDocument,
    /** 详情内嵌进度：静默轮询，不弹 #translation-workflow-dialog */
    attachJobProgress,
  };
  return { ...controller, submitDocument: submit.submitDocument } satisfies LibraryController;
}
