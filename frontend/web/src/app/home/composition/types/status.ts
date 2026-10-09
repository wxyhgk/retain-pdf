// status：状态/任务运行时域（只读 store 可抽）。
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

// 任务详情的两个 store 直接用 job-detail 导出的真实类型（以前这里手抄了一份，参数全是 unknown，对不上）。
import type { StatusDetailController, StatusDetailDialogStore, StatusDetailStore } from "@/features/job-detail/index.js";
export type { StatusDetailDialogStore, StatusDetailStore };

export type { StatusDetailController };

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
