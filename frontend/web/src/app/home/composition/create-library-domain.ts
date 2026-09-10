// recent-jobs ports + library controller + collections。
//
// 域装配显性化:本函数只做装配,不写业务——
// ports(状态/视图/资源/运行时/阅读器/导航/actions)→
// libraryController(唯一业务入口)→ collections(独立域,并行返回)。
// 业务前置条件见 features/library/domain/controller.ts 各方法注释。

import { API_PREFIX } from "@/platform/config/api-constants.js";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";
import { createStore } from "@/platform/store/store.js";
import { fetchDocumentList, fetchJobPayload } from "@/platform/api/index.js";
// Pilot: library-books migrated to @retainpdf/api (direct). Keep fetchDocumentList from external barrel.
import { isMockMode } from "@/platform/config/runtime.js";
import { getMockJobList } from "@/platform/mock/index.js";
import { countMockFavoritesByJob } from "@/platform/mock/documents.js";
import {
  fetchLibraryBookList as _fetchLibraryBookList,
  deleteLibraryBook as _deleteLibraryBook,
} from "@retainpdf/api/library-books";
import { stripOcrSuffix } from "@retainpdf/api/utils/strip-ocr";

async function fetchLibraryBookList(apiPrefix: string, opts: any = {}): Promise<any> {
  if (isMockMode()) {
    const jobIds = Array.isArray(opts?.jobIds) ? opts.jobIds : [];
    return getMockJobList({ jobIds });
  }
  return (_fetchLibraryBookList as any)(apiPrefix, opts);
}
async function deleteLibraryBook(apiPrefix: string, jobId: string, opts: any = {}): Promise<any> {
  const normalizedJobId = stripOcrSuffix(`${jobId || ""}`);
  if (!normalizedJobId) throw new Error("删除失败: 缺少 job_id");
  if (isMockMode()) {
    const referenced = countMockFavoritesByJob(normalizedJobId);
    if (referenced > 0 && !opts?.force) {
      const conflict = new Error(`该 job 被 ${referenced} 条收藏引用(409)`) as Error & { status?: number };
      (conflict as any).status = 409;
      throw conflict;
    }
    return { job_id: normalizedJobId };
  }
  return (_deleteLibraryBook as any)(apiPrefix, jobId, opts);
}
import {
  createRecentJobsStatePort,
  createRecentJobActions,
  createRecentJobsRuntimePort,
  createRecentJobsReaderPort,
  createRecentJobsNavigationPort,
  createRecentJobsLibraryRefreshPort,
  createDocumentLibraryResource,
} from "@/features/library/index.js";
// readActiveJobId 属 jobs 而非 library，容易归错。
import { readActiveJobId } from "@/features/jobs/index.js";
import {
  createLibraryController,
  createRecentJobsReactViewPort,
} from "@/features/library/index.js";
import { createCollectionsController } from "@/features/collections/index.js";
import type {
  CollectionsController,
  CollectionsReloadSignal,
  HomeFeatures,
  RecentJobActions,
} from "./types.js";
import type {
  LibraryController,
  RecentJobsReactViewPort,
  ReloadRecentJobsOptions,
} from "@/features/library/index.js";
import { createDialogStore, type DialogStore } from "@/platform/store/dialog-store.js";
import type { LibraryCardItem } from "@/features/library/index.js";

type ReaderAnchor = {
  pageIdx?: number | null;
  blockId?: string;
} | null;

type CreateLibraryDomainArgs = {
  features: HomeFeatures;
  documentRef: Document;
  statusArea: { setVisible: (visible: boolean) => void };
};

export function createLibraryDomain({ features, documentRef, statusArea }: CreateLibraryDomainArgs) {
  // 装配顺序:事件/状态/视图 → 文档资源 → 运行时/阅读器/导航 → actions → controller。
  const libraryEventPort = createRecentJobsLibraryRefreshPort({ target: documentRef });
  const recentJobsStatePort = createRecentJobsStatePort();
  const recentJobsViewPort = createRecentJobsReactViewPort() as RecentJobsReactViewPort;
  const documentLibraryResource = createDocumentLibraryResource({
    fetchDocumentList,
    fetchLibraryBookList,
    fetchJobPayload,
    apiPrefix: API_PREFIX,
  });

  // 下层 port 工厂 `= {}` 默认参会丢掉无默认字段（openJob / closeDialog 等）。
  const recentJobsJobRuntimePort = createRecentJobsRuntimePort({
    // 网格点任务：仅 silent 轮询（进度在详情 Tab）；不抬主工作流
    openJob: (jobId: string) => (
      features.jobRuntimeFeature.startPolling(jobId, {
        silent: true,
        showWorkflow: false,
        publishLibrary: false,
      })
    ),
    // 冷启动恢复活跃任务：silent，不抬主状态区、不刷库 create 事件
    recoverJob: (jobId: string) => (
      features.jobRuntimeFeature.startPolling(jobId, { silent: true })
    ),
    currentJobId: () => features.jobRuntimeFeature.currentJobId() || "",
  });

  const recentJobsReaderPort = createRecentJobsReaderPort({
    openReader: (jobId: string, anchor: ReaderAnchor = null, documentId = "") => {
      const normalizedJobId = `${jobId || ""}`.trim();
      if (!normalizedJobId) return;
      // Reader 会在自己的 iframe/session 内读取 job、产物和 live translation。
      // 这里不能让被阅读的 job 接管首页唯一的 currentJob 轮询：打开一本已完成
      // 的 PDF 会立刻命中终态并清掉正在后台执行的另一项任务及其持久化恢复键。
      documentRef.dispatchEvent(new globalThis.CustomEvent(APP_EVENTS.openReaderRequested, {
        detail: {
          jobId: normalizedJobId,
          documentId: `${documentId || ""}`.trim(),
          pageIdx: Number.isFinite(anchor?.pageIdx) ? anchor.pageIdx : null,
          blockId: anchor?.blockId || "",
        },
      }));
    },
  });

  const recentJobsNavigationPort = createRecentJobsNavigationPort({
    closeDialog: () => {},
    currentJobId: () => features.jobRuntimeFeature.currentJobId() || "",
    jobRuntimePort: recentJobsJobRuntimePort,
    readerPort: recentJobsReaderPort,
    doc: documentRef,
  });

  // startPolling/openReader/closeRecentJobsDialog 可由 navigationPort 兜底；签名仍标必填。
  const recentJobActions = createRecentJobActions({
    apiPrefix: API_PREFIX,
    deleteLibraryBook,
    activeJobRecoveryPort: { readActiveJobId },
    navigationPort: recentJobsNavigationPort,
    renderCurrentRecentJobs: () => {},
    renderRecentJobsEmpty: recentJobsViewPort.renderEmpty,
    renderRecentJobsError: recentJobsViewPort.renderError,
    statePort: recentJobsStatePort,
  }) as RecentJobActions;

  // libraryController 装配:网格乐观写直连 statePort,重载/删除 delegations 经 features/actions。
  const libraryController = createLibraryController({
    documentRef,
    libraryEventPort,
    reloadRecentJobs: async (opts?: ReloadRecentJobsOptions) => {
      await features.recentJobsFeature.loadRecentJobs(opts);
    },
    removeLibraryDocuments: (documentIds: string[]) => {
      const selectedDocumentIdSet = new Set((documentIds || []).map((id) => `${id || ""}`.trim()).filter(Boolean));
      if (!selectedDocumentIdSet.size) {
        return;
      }
      const { items } = recentJobsStatePort.getSnapshot();
      recentJobsStatePort.setItems(
        items.filter((item) => !selectedDocumentIdSet.has(`${item?.document_id || ""}`.trim())),
      );
    },
    patchLibraryDocumentItem: (documentId: string, patch) => {
      const targetDocumentId = `${documentId || ""}`.trim();
      if (!targetDocumentId || !patch || typeof patch !== "object") {
        return;
      }
      const { items } = recentJobsStatePort.getSnapshot();
      recentJobsStatePort.setItems(
        items.map((item) => (
          `${item?.document_id || ""}`.trim() === targetDocumentId ? { ...item, ...patch } : item
        )),
      );
    },
    deleteJob: async (jobId: string) => {
      await recentJobActions.deleteJob(jobId);
    },
    buildTranslateConfig: (pageRanges?: string) => features.workflowFeature.buildTranslateJobConfig(pageRanges),
    buildOcrConfig: (pageRanges?: string) => features.workflowFeature.buildOcrJobConfig(pageRanges),
    startPolling: (jobId: string, options?: {
      silent?: boolean;
      publishLibrary?: boolean;
      showWorkflow?: boolean;
      seedPayload?: Record<string, unknown> | null;
      recovering?: boolean;
    }) => {
      features.jobRuntimeFeature.startPolling(jobId, options);
    },
    hideStatusArea: () => statusArea.setVisible(false),
    recentJobsStatePort,
  }) as LibraryController;

  return {
    libraryEventPort,
    recentJobsStatePort,
    recentJobsViewPort,
    documentLibraryResource,
    recentJobsJobRuntimePort,
    recentJobsReaderPort,
    recentJobsNavigationPort,
    recentJobActions,
    libraryController,
    bookDetailStore: libraryController.bookDetailStore as DialogStore<LibraryCardItem | null>,
    collectionsController: createCollectionsController({ apiPrefix: API_PREFIX }),
    // payload = 正在编辑的 CollectionRecord，null 表示新建模式。
    collectionManageDialogStore: createDialogStore(null),
    collectionsReloadSignal: createStore<
      { version: number },
      { bump: (state: { version: number }) => { version: number } }
    >({
      name: "collectionsReload",
      initialState: { version: 0 },
      actions: {
        bump: (state) => ({ version: state.version + 1 }),
      },
    }) as CollectionsReloadSignal,
  };
}
