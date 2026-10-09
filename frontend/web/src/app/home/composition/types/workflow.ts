// workflow：workflow/upload 文本视图域。
import type { TranslationWorkflowDialogStatePort } from "@/features/ingest/domain.js";

export type DialogStatePort = TranslationWorkflowDialogStatePort;

export type UploadDomRefs = {
  fileInput: HTMLInputElement | null;
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
