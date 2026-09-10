// types-split/workflow.ts — workflow/upload 文本视图域。
import type { TranslationWorkflowDialogStatePort } from "@/features/ingest/domain.js";
import type { ReadOnlyStore } from "./common.js";

export type DialogStatePort = TranslationWorkflowDialogStatePort;

export type UploadDomRefs = {
  fileInput: HTMLInputElement | null;
};

export type UploadViewActions = {
  patch: (payload: Record<string, unknown>) => unknown;
};

export type WorkflowViewActions = {
  setSelectedGlossaryId: (id: string) => unknown;
  setOcrOnly: (value: boolean) => unknown;
  isOcrOnly: () => boolean;
};

export type WorkflowDialogRuntime = {
  bindEvents: () => () => void;
  close: () => void;
  isOpen: () => boolean;
  openFromEvent: (event?: Event) => void;
  openUpload: () => void;
  requestClose: () => void;
  requestOpenUpload: () => void;
  statePort?: DialogStatePort;
  sync?: () => void;
};

/** Upload 分域窄端口：仅 DOM refs + actions + 只读 store */
export type UploadPort = {
  domRefs: UploadDomRefs;
  viewActions: UploadViewActions;
  store: ReadOnlyStore;
};

/** Text 分域窄端口 */
export type TextPort = {
  store: ReadOnlyStore;
  textOf: (snapshot: unknown, id: string, fallback?: unknown) => unknown;
};

/** Workflow 分域窄端口 */
export type WorkflowPort = {
  viewActions: WorkflowViewActions;
  dialog: WorkflowDialogRuntime;
  store: ReadOnlyStore;
};
