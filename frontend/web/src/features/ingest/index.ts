// ingest —— 添加 PDF：上传、选择处理方式（仅收藏 / OCR / 翻译）、
// 页码范围与术语表选项，直到提交任务为止的整条链路。
//
// 这是本功能对外的唯一出口。
// ui/     「添加 PDF」弹窗与其内的上传区、处理方式选择、页码范围、提示条
// domain/ upload/ 上传流程与容量  workflow/ 工作流规则与 payload
//         actions/ 提交编排        dialog/ 弹窗状态与状态区端口
//         以及三个视图 store（无 React）
// 调度归属：提交兜底归 domain/actions/submit-flow.ts publishSubmitSuccess
// （800ms/5s 两路刷新，返回取消函数；总表见 platform/contracts/app-contract.ts）。
//
// 非 React 调用方请从 ./domain.js 导入。

// 逐条显式列举（不用 export *）——barrel 无差别转出会连带触发模块级副作用。
export {
  clearAppliedPageRange,
  collectUploadFormData,
  countPdfPages,
  createAppActionsRuntimeEnvPort,
  createTranslationWorkflowDialogRuntime,
  createTranslationWorkflowDialogStatePort,
  createTranslationWorkflowStatusAreaPort,
  createUploadStatePort,
  createUploadStore,
  createUploadViewFeature,
  createWorkflowViewFeature,
  defaultAppActionsConfigPort,
  defaultUploadConfigPort,
  defaultWorkflowConfigPort,
  getUploadState,
  getUploadStatePort,
  mountAppActionsFeature,
  mountUploadFeature,
  mountWorkflowFeature,
  normalizeMathMode,
  normalizeWorkflow,
  resetUploadState,
  setAppliedPageRange,
  setUploadState,
  setUploadSubmitBusy,
  TRANSLATION_WORKFLOW_DIALOG,
  TRANSLATION_WORKFLOW_MODES,
  workflowConstants,
  WORKFLOW_BOOK,
  WORKFLOW_OCR,
  WORKFLOW_RENDER,
  WORKFLOW_TRANSLATE,
} from "./domain.js";
export type {
  ConstrainPageRangesOptions,
  LoadGlossaryOptionsParams,
  MountUploadFeatureOptions,
  MountWorkflowFeatureOptions,
  TranslationWorkflowDialogStatePort,
  UploadActions,
  UploadConfigPortLike,
  UploadPayload,
  UploadResetOptions,
  UploadResponsePayload,
  UploadState,
  UploadStatePort,
  UploadStore,
  UploadViewPort,
  WorkflowConfigPortLike,
  WorkflowConstants,
  WorkflowRunPayload,
  WorkflowSubmitValues,
  WorkflowViewPortLike,
} from "./domain.js";
export { IngestDialog } from "./ui/IngestDialog.jsx";
export { WorkflowPanel } from "./ui/WorkflowPanel.jsx";
export { TranslationOptionsPanel } from "./ui/components/TranslationOptionsPanel.jsx";
export { UploadTile } from "./ui/components/UploadTile.jsx";
export {
  IngestServicesProvider,
  IngestWorkflowViewProvider,
  useIngestServices,
  useIngestWorkflowView,
} from "./ui/workflow-view-context.jsx";
export type { IngestFeatures, IngestServices, IngestWorkflowView } from "./ui/workflow-view-context.jsx";
export type { UploadViewStore } from "./domain/upload-store.js";
export type { CredentialGateRequest } from "./domain/workflow/workflow-mode.js";
