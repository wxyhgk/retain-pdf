// types-split/status.ts — 状态/任务运行时域（只读 store 可抽）。
import type { DialogStore } from "@/platform/store/dialog-store.js";
import type { ArtifactDownloadBusyStore } from "@/features/artifacts/index.js";
import type { LibraryJobItem } from "@/features/library/index.js";
import type { ReadOnlyStore } from "./common.js";

export type HomeArtifactDownloads = {
  busyStore: ArtifactDownloadBusyStore;
};

export type HomeStatusCard = {
  store: ReadOnlyStore<{ snapshot: unknown; cancelDisabled: boolean }>;
  cancelCurrentJob: () => unknown;
};

/** 1 秒 job runtime 轮询写入的 canonical 当前任务状态。 */
export type HomeJobRuntime = {
  store: ReadOnlyStore<{
    jobId?: string;
    snapshot?: LibraryJobItem | null;
    startedAt?: string;
    finishedAt?: string;
  }>;
};

export type StatusDetailStoreActions = {
  resetOverview: () => unknown;
  resetTranslation: () => unknown;
  setOverview?: (overview: unknown) => unknown;
  setTranslation?: (translation: unknown) => unknown;
  setRerunPending?: (pending: boolean) => unknown;
};

export type StatusDetailStore = ReadOnlyStore & {
  actions: StatusDetailStoreActions;
  getSnapshot: () => unknown;
  subscribe: (listener: (snapshot: unknown, meta?: unknown) => void) => () => void;
};

export type StatusDetailDialogStore = DialogStore<{ activeTab?: string } | null>;

export type StatusDetailController = {
  activateDetailTab: (name?: string) => void;
  openStatusDetailDialog: (tabName?: string) => void;
  buildDetailPageUrl: (jobId: string) => string;
  ensureOverviewData: () => Promise<unknown> | unknown;
  ensureTranslationData: () => Promise<unknown> | unknown;
  applyTranslationFilter: (...args: unknown[]) => unknown;
  changeTranslationPage: (...args: unknown[]) => unknown;
  selectTranslationItem: (...args: unknown[]) => unknown;
  replayCurrentItem: (...args: unknown[]) => unknown;
  rerunCurrentJob: () => Promise<unknown> | unknown;
  syncRerunAction: (statusText?: string) => unknown;
};

export type HomeStatusDetail = {
  store: StatusDetailStore;
  dialogStore: StatusDetailDialogStore;
  controller: StatusDetailController;
};

export type StatusAreaBag = {
  store: ReadOnlyStore;
  isVisible: () => boolean;
  setVisible: (visible: boolean) => void;
  setWorkflowSections: (job?: unknown) => void;
  statusAreaPort?: unknown;
};

export type StatusDetailHolder = {
  store: StatusDetailStore | null;
  dialogStore: StatusDetailDialogStore | null;
};
