// types-split/library.ts — 文库域。
import type { DialogStore } from "@/platform/store/dialog-store.js";
import type {
  DeleteCardTarget,
  DeleteDocumentsResult,
  JobSubmissionView,
  LibraryCardItem,
  LibraryController,
  RecentJobsReactViewPort,
  TranslateDocumentPayload,
  UpdateDocumentPayload,
} from "@/features/library/index.js";
import type { ReadOnlyStore } from "./common.js";

export type RecentJobActions = {
  selectJob: (jobId: string) => unknown;
  deleteJob: (jobId: string) => Promise<unknown> | unknown;
  openJobReader: (jobId: string, documentId?: string) => unknown;
  recoverActiveJob: (items?: unknown[]) => unknown;
};

export type LibraryActions = RecentJobActions & {
  openSourceReader: LibraryController["openSourceReader"];
  translateDocument: LibraryController["translateDocument"];
  ocrDocument: LibraryController["ocrDocument"];
  /** 统一提交入口（按 workflow 分流到 ocr/translate） */
  submitDocument: (documentId?: string | null, payload?: unknown) => Promise<unknown>;
  getDocumentJobs: LibraryController["getDocumentJobs"];
  getDocumentByJobId: LibraryController["getDocumentByJobId"];
  getJobStageActions: LibraryController["getJobStageActions"];
  retryJobStage: LibraryController["retryJobStage"];
  deleteDocument: LibraryController["deleteDocument"];
  /** 选择集可能是 unknown[]（view state），参数放宽 */
  deleteDocuments: (
    documentIds?: Array<string | null | undefined | unknown>,
  ) => Promise<DeleteDocumentsResult>;
  deleteCard: LibraryController["deleteCard"];
  openBookDetail: LibraryController["openBookDetail"];
  updateDocument: LibraryController["updateDocument"];
  storeOnly: LibraryController["storeOnly"];
  attachJobProgress: LibraryController["attachJobProgress"];
};

export type HomeLibrary = {
  viewPort: RecentJobsReactViewPort;
  recentJobsStore: ReadOnlyStore<{ items: LibraryCardItem[]; [key: string]: unknown }>;
  actions: LibraryActions;
};

export type HomeBookDetail = {
  dialogStore: DialogStore<LibraryCardItem | null>;
};

/** 分类/合集控制器（createCollectionsController 返回面） */
// CollectionRecord 的真值在功能内（src/features/collections），装配层只引用它：
// 依赖方向 app -> features。
export type { CollectionRecord } from "@/features/collections/index.js";
import type { CollectionRecord } from "@/features/collections/index.js";

export type CollectionDocumentRecord = {
  document_id?: string;
  title?: string;
  [key: string]: unknown;
};

export type CollectionsListResult = {
  collections?: CollectionRecord[];
};

// CollectionsController 的真值是功能内 createCollectionsController 的返回类型，
// 装配层不再手写一份（手写版曾与实现的 fetchFolderBooks 返回类型不兼容）。
export type { CollectionsController } from "@/features/collections/index.js";
import type { CollectionsController } from "@/features/collections/index.js";

/** createStore 返回的 actions 经 BoundStoreActions 后难精确建模；消费面只认 bump */
export type CollectionsReloadSignal = {
  getSnapshot: () => { version: number };
  subscribe: (listener: (snapshot: { version: number }, meta?: unknown) => void) => () => void;
  actions: {
    bump: (...args: unknown[]) => unknown;
  };
};

export type HomeCollections = {
  controller: CollectionsController;
  dialogStore: DialogStore<CollectionRecord | null>;
  reloadSignal: CollectionsReloadSignal;
};

// re-export library helpers used by consumers of HomeServices actions
export type {
  DeleteCardTarget,
  DeleteDocumentsResult,
  JobSubmissionView,
  LibraryCardItem,
  TranslateDocumentPayload,
  UpdateDocumentPayload,
};
