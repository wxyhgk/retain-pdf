// ingest 的「非 React」出口。
//
// 供装配层与跨页调用方（如 js/bootstrap/job-domain-adapters）使用；
// React 侧从 index.ts 导入。index.ts 整体转出本文件，两处不会漂移。

export * from "./domain/upload/state.js";
export * from "./domain/upload/controller.js";
export { countPdfPages } from "./domain/upload/pdf-page-count.js";
export { collectUploadFormData } from "./domain/upload/form-data.js";
export { defaultUploadConfigPort } from "./domain/upload/config-port.js";

export * from "./domain/workflow/controller.js";
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
export { defaultAppActionsConfigPort } from "./domain/actions/config-port.js";
export { createAppActionsRuntimeEnvPort } from "./domain/actions/runtime-env-port.js";

export { createUploadViewFeature } from "./domain/upload-store.js";
export { createWorkflowViewFeature } from "./domain/workflow-view-store.js";
export { createTranslationWorkflowDialogRuntime } from "./domain/translation-workflow-dialog-runtime.js";
export * from "./domain/workflow-config.js";
