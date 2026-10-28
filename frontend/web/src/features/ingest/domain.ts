// ingest 的「非 React」出口。
//
// 供装配层与跨页调用方（如 js/bootstrap/job-domain-adapters）使用；
// React 侧从 index.ts 导入。index.ts 逐条转出本文件，两处不会漂移。
// 逐条显式列举，不用 export * —— barrel 无差别转出会连带触发模块级副作用。

export {
  clearAppliedPageRange,
  createUploadStatePort,
  createUploadStore,
  getUploadState,
  getUploadStatePort,
  resetUploadState,
  setAppliedPageRange,
  setUploadState,
  setUploadSubmitBusy,
} from "./domain/upload/state.js";
export type {
  UploadActions,
  UploadPayload,
  UploadResetOptions,
  UploadState,
  UploadStatePort,
  UploadStore,
} from "./domain/upload/state.js";
export { mountUploadFeature } from "./domain/upload/controller.js";
export type {
  ConstrainPageRangesOptions,
  MountUploadFeatureOptions,
  UploadConfigPortLike,
  UploadResponsePayload,
  UploadViewPort,
} from "./domain/upload/controller.js";
export { countPdfPages } from "./domain/upload/pdf-page-count.js";
export { collectUploadFormData } from "./domain/upload/form-data.js";
export { defaultUploadConfigPort } from "./domain/upload/config-port.js";

export { mountWorkflowFeature } from "./domain/workflow/controller.js";
export type {
  LoadGlossaryOptionsParams,
  MountWorkflowFeatureOptions,
  WorkflowConfigPortLike,
  WorkflowConstants,
  WorkflowRunPayload,
  WorkflowSubmitValues,
  WorkflowViewPortLike,
} from "./domain/workflow/controller.js";
export { defaultWorkflowConfigPort } from "./domain/workflow/config-port.js";

export {
  TRANSLATION_WORKFLOW_DIALOG,
  TRANSLATION_WORKFLOW_MODES,
} from "./domain/dialog/contract.js";
export {
  createTranslationWorkflowDialogStatePort,
  type TranslationWorkflowDialogStatePort,
} from "./domain/dialog/state.js";
export { createTranslationWorkflowStatusAreaPort } from "./domain/dialog/status-area-port.js";

export { mountAppActionsFeature } from "./domain/actions/controller.js";
export type { BatchSubmitItemResult, BatchSubmitResult } from "./domain/actions/submit/batch.js";
export { defaultAppActionsConfigPort } from "./domain/actions/config-port.js";
export { createAppActionsRuntimeEnvPort } from "./domain/actions/runtime-env-port.js";

export { createUploadViewFeature } from "./domain/upload-store.js";
export { createWorkflowViewFeature } from "./domain/workflow-view-store.js";
export { createTranslationWorkflowDialogRuntime } from "./domain/translation-workflow-dialog-runtime.js";
export {
  normalizeMathMode,
  normalizeWorkflow,
  workflowConstants,
  WORKFLOW_BOOK,
  WORKFLOW_OCR,
  WORKFLOW_RENDER,
  WORKFLOW_TRANSLATE,
} from "./domain/workflow-config.js";
