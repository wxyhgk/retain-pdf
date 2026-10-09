// library：文库域。
import type { DialogStore } from "@/platform/store/dialog-store.js";
import type {
  CollectionRecord,
  CollectionsController,
} from "@/features/collections/index.js";
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

export type {
  CollectionRecord,
  CollectionsController,
  DeleteCardTarget,
  DeleteDocumentsResult,
  JobSubmissionView,
  LibraryCardItem,
  TranslateDocumentPayload,
  UpdateDocumentPayload,
};

// RecentJobActions / LibraryActions 归书架功能所有（features/library/domain/types.ts），这里转出。
export type { LibraryActions, RecentJobActions } from "@/features/library/index.js";
import type { LibraryServices } from "@/features/library/index.js";

/** 就是书架功能自己的服务类型（LibraryServicesProvider 的值）。 */
export type HomeLibrary = LibraryServices;

export type HomeBookDetail = {
  dialogStore: DialogStore<LibraryCardItem | null>;
};

export type CollectionDocumentRecord = {
  document_id?: string;
  title?: string;
  [key: string]: unknown;
};

export type CollectionsListResult = {
  collections?: CollectionRecord[];
};

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
