// library 域共享类型：网格卡片 item、controller 契约、viewPort / viewStore。
// 字段从 shapeDocumentCardItem / mergeLibraryJobItem / cardSignatureOf 反推。

import type { DialogStore } from "@/platform/store/dialog-store.js";
import type {
  Store,
  StoreChangeMeta,
} from "@/platform/store/store.js";

// 这两个型别已下沉到 platform（platform/mock 与 api/legacy 需要它们，
// features → platform 才是正方向）。本文件内部仍要用它们，所以 import 与
// re-export 各写一条：`export type {} from` 只转出，不引入本地作用域。
import type {
  LibraryProgress,
  LibraryRuntimeStatus,
  LibraryBackgroundStage,
  LibraryBookSummary,
  LibraryCardItem,
  JobSubmissionView,
} from "@/platform/contracts/library-payloads.js";

export type {
  LibraryProgress,
  LibraryRuntimeStatus,
  LibraryBackgroundStage,
  LibraryBookSummary,
  LibraryCardItem,
  JobSubmissionView,
};

// ─── 进度 / 运行时 ───────────────────────────────────────────────





// ─── 网格卡片 item ───────────────────────────────────────────────

/**
 * 书架网格/列表/详情共用的卡片投影。
 * - 已翻译：真实 job_id + library/books 活态
 * - 馆藏：library_only + 合成 job_id `doc:<document_id>`
 *
 * 扩展字段经 index signature 放行；已知字段尽量列全，避免 any。
 */

/** job 中心命名别名（与 LibraryCardItem 同一形状） */
export type LibraryJobItem = LibraryCardItem;

/** 历史命名别名（recent-jobs 引擎侧） */
export type RecentJobItem = LibraryCardItem;

// ─── 卡片操作 / 徽标 ─────────────────────────────────────────────

export type BookCardAction = {
  id: string;
  label: string;
  icon?: string;
  className?: string;
  disabled?: boolean;
  onClick?: (event?: unknown, current?: LibraryCardItem) => void;
};

export type BookCardActionHandlers = {
  onReader?: (jobId: string, documentId?: string) => void;
  onReadSource?: (documentId: string) => void;
  onTranslate?: (item: LibraryCardItem) => void;
};

export type LibraryCardBadge = {
  label: string;
  icon: string;
  cls: string;
};

// ─── 文档 API payload ────────────────────────────────────────────

export type TranslateDocumentPayload = {
  workflow?: "book" | "translate" | string;
  source?: {
    artifact_job_id?: string;
    upload_id?: string;
    [key: string]: unknown;
  };
  ocr?: {
    page_ranges?: string;
    [key: string]: unknown;
  };
  translation?: {
    /** 一基文档页码；空数组表示整本或沿用旧范围语义。 */
    page_ranges?: number[];
    /** 旧任务兼容字段；OCR 复用请求优先使用 page_ranges。 */
    start_page?: number;
    end_page?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type OcrDocumentPayload = {
  workflow?: "ocr" | string;
  ocr?: {
    page_ranges?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type DocumentJobSummary = LibraryCardItem & {
  job_id: string;
  workflow: string;
  status: string;
};

/** POST /documents/:id/translate 返回（JobSubmissionView） */

export type UpdateDocumentPayload = {
  title?: string;
  reading_status?: string;
  tags?: string[];
  [key: string]: unknown;
};

export type DeleteCardTarget = {
  documentId?: string;
  jobId?: string;
};

export type DeleteDocumentsResult = {
  confirmed: number;
  failed: number;
};

export type ReloadRecentJobsOptions = {
  reset?: boolean;
  silent?: boolean;
  [key: string]: unknown;
};

// ─── Controller ──────────────────────────────────────────────────

export type LibraryEventPort = {
  requestRefresh?: (opts?: {
    force?: boolean;
    delay?: number;
    [key: string]: unknown;
  }) => void;
  publishJobCreated?: (job?: LibraryCardItem | Record<string, unknown> | null) => void;
  publishJobUpdated?: (job?: LibraryCardItem | Record<string, unknown> | null) => void;
};

/** 乐观删卡：从网格 store 按 document_id 过滤（可选注入） */
export type RemoveLibraryDocumentsFn = (documentIds: string[]) => void;

/** 乐观改卡：按 document_id 合并字段 */
export type PatchLibraryDocumentItemFn = (
  documentId: string,
  patch: Partial<LibraryCardItem>,
) => void;

export type LibraryControllerDeps = {
  documentRef?: Pick<Document, "dispatchEvent"> | null;
  libraryEventPort?: LibraryEventPort | null;
  reloadRecentJobs?: (opts?: ReloadRecentJobsOptions) => void | Promise<void>;
  /** 乐观移除网格行；缺省则只靠 silent reload */
  removeLibraryDocuments?: RemoveLibraryDocumentsFn | null;
  /** 乐观更新网格行元数据 */
  patchLibraryDocumentItem?: PatchLibraryDocumentItemFn | null;
  deleteJob?: (jobId: string) => void | Promise<void>;
  buildTranslateConfig?: (
    pageRanges?: string,
  ) => TranslateDocumentPayload | Record<string, unknown>;
  buildOcrConfig?: (
    pageRanges?: string,
  ) => OcrDocumentPayload | Record<string, unknown>;
  startPolling?: (
    jobId: string,
    options?: {
      silent?: boolean;
      publishLibrary?: boolean;
      showWorkflow?: boolean;
      seedPayload?: Record<string, unknown> | null;
      recovering?: boolean;
    },
  ) => void;
  hideStatusArea?: () => void;
  /** 网格状态端口（供 selectJob 的 findItem 内聚到 controller） */
  recentJobsStatePort?: any | null;
};

export type LibraryController = {
  bookDetailStore: DialogStore<LibraryCardItem | null>;
  openSourceReader: (documentId?: string | null) => void;
  storeOnly: () => void;
  translateDocument: (
    documentId?: string | null,
    payload?: TranslateDocumentPayload,
  ) => Promise<JobSubmissionView | null>;
  ocrDocument: (
    documentId?: string | null,
    payload?: OcrDocumentPayload,
  ) => Promise<JobSubmissionView | null>;
  getDocumentJobs: (
    documentId?: string | null,
  ) => Promise<{ items: DocumentJobSummary[] }>;
  /** Resolve the owning document for a globally submitted job. */
  getDocumentByJobId: (
    jobId?: string | null,
  ) => Promise<LibraryCardItem | null>;
  getJobStageActions: (jobId?: string | null) => Promise<unknown>;
  retryJobStage: (
    jobId?: string | null,
    stage?: string | null,
    payload?: Record<string, unknown>,
  ) => Promise<JobSubmissionView | null>;
  deleteDocument: (documentId?: string | null) => Promise<void>;
  deleteDocuments: (
    documentIds?: Array<string | null | undefined>,
  ) => Promise<DeleteDocumentsResult>;
  deleteCard: (target?: DeleteCardTarget) => void;
  openBookDetail: (item?: LibraryCardItem | null) => void;
  /**
   * 网格选中任务：有 document_id → 详情处理 Tab + silent 进度；
   * 否则 fallbackSelectJob（旧工作流弹窗）。
   */
  selectJobForDetail: (
    jobId?: string | null,
    options?: {
      findItem?: (jobId: string) => LibraryCardItem | null | undefined;
      fallbackSelectJob?: (jobId: string) => void;
    },
  ) => void;
  /** 網格選任務的業務封裝（findItem 內聚到 controller，不再由 build-home-services 拼） */
  selectJob: (jobId: string) => unknown;
  updateDocument: (
    documentId?: string | null,
    payload?: UpdateDocumentPayload,
  ) => Promise<unknown>;
  /** 详情内嵌进度：静默 startPolling，不弹工作流、不亮主状态区 */
  attachJobProgress: (
    jobId?: string | null,
    options?: { recovering?: boolean },
  ) => void;
};

// ─── View store / viewPort ───────────────────────────────────────

export type LibraryViewMode = "loading" | "empty" | "error" | "list" | string;

export type LibraryViewState = {
  mode: LibraryViewMode;
  message: string;
  hasMore: boolean;
  loadMoreLoading: boolean;
  query: string;
};

export type LibraryViewActions = {
  setLoading(state: LibraryViewState): LibraryViewState;
  setEmpty(state: LibraryViewState, message?: string): LibraryViewState;
  setErrorReset(state: LibraryViewState, message?: string): LibraryViewState;
  clearLoadMoreLoading(state: LibraryViewState): LibraryViewState;
  setList(state: LibraryViewState, hasMore?: boolean): LibraryViewState;
  setLoadMoreLoading(state: LibraryViewState): LibraryViewState;
  setQuery(state: LibraryViewState, query?: string): LibraryViewState;
};

export type LibraryViewStore = Store<LibraryViewState, LibraryViewActions>;

export type RecentJobsViewPortHandlers = {
  onOpen?: ((jobId: string) => void) | null;
  onLoadMore?: (() => void) | null;
  onSearch?: ((query: string) => void) | null;
  isSuspended?: () => boolean;
};

export type RecentJobsReactViewPortOptions = {
  store?: LibraryViewStore;
};

export type AutoLoadCheckOptions = {
  isSuspended?: boolean;
  [key: string]: unknown;
};

export type RecentJobsReactViewPort = {
  store: LibraryViewStore;
  handlersRef: { current: RecentJobsViewPortHandlers };
  bindEvents: (handlers?: Partial<RecentJobsViewPortHandlers>) => void;
  hasView: () => boolean;
  registerAutoLoadChecker: (
    checker: ((options?: AutoLoadCheckOptions) => void) | null | undefined,
  ) => () => void;
  renderEmpty: (message?: string, invocationSummary?: unknown) => void;
  renderError: (message?: string, options?: { reset?: boolean }) => void;
  renderList: (options?: { hasMore?: boolean; [key: string]: unknown }) => void;
  renderLoading: () => void;
  replaceCard: (...args: unknown[]) => boolean;
  scheduleAutoLoadCheck: (options?: AutoLoadCheckOptions) => void;
  setDialogOpen: (...args: unknown[]) => void;
  setLoadMoreLoading: () => void;
};

// 再导出 StoreChangeMeta 供订阅方如需标注 meta 使用
export type { StoreChangeMeta };
