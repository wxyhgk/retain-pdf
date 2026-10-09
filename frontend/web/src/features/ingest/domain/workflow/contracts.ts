// workflow 域内部共享的端口 / 载荷契约类型。
//
// 这些类型原先内联在 controller.ts，拆分后集中到这里，再由 controller.ts
// `export *` 转出，保证对外导出名与 import 路径不变。

import type { WorkflowPayloadConstants } from "./payload.js";
import type { WorkflowPreferences } from "../workflow-preferences.js";

export interface WorkflowSubmitValues {
  ocrProvider?: string;
  ocrCredentialRef?: string;
  ocrToken?: string;
  translationCredentialRef?: string;
  modelApiKey?: string;
  selectedGlossaryId?: string;
  /** 用户偏好整张表（workflow-preferences.ts），按表搬运，不逐个字段列。 */
  preferences?: Partial<WorkflowPreferences>;
}

export interface LoadGlossaryOptionsParams {
  force?: boolean;
  selectedId?: string;
}

export interface WorkflowConfigPortLike {
  isMock: () => boolean;
  mockScenario: () => string;
}

export interface WorkflowViewPortLike {
  setDeveloperGlossaryOptions: (glossaries?: unknown[], selectedId?: string) => void;
  setDeveloperDialog: (config: unknown) => void;
  readDeveloperWorkflow: () => string;
  setDeveloperWorkflowFormState: (state: {
    workflow: string;
    workflowRender: string;
    workflowTranslate: string;
  }) => void;
  renderBudgetNote: (budget: unknown) => void;
  setSubmitControls: (state: unknown) => void;
  applyMockUpload: (options: {
    mockScenario?: string;
    submitLabel?: string;
    showPageRangeButton?: boolean;
  }) => void;
  applyWorkflowUpload: (options: {
    needsUpload?: boolean;
    uploadReady?: boolean;
    defaultFileLabel?: string;
    headline?: string;
    renderSourceJobId?: string;
  }) => void;
  readDeveloperDialog: (options?: unknown) => unknown;
  closeDeveloperDialog: () => void;
  readSubmitValues?: (options?: {
    defaultOcrProvider?: string;
    defaultPaddleToken?: string;
    defaultModelApiKey?: string;
  }) => WorkflowSubmitValues;
}

export interface WorkflowConstants extends WorkflowPayloadConstants {
  DEFAULT_WORKERS: number;
  DEFAULT_BATCH_SIZE: number;
  DEFAULT_CLASSIFY_BATCH_SIZE: number;
  DEFAULT_COMPILE_WORKERS: number;
  DEFAULT_TIMEOUT_SECONDS: number;
  WORKFLOW_BOOK: string;
  WORKFLOW_TRANSLATE: string;
  WORKFLOW_RENDER: string;
  WORKFLOW_OCR?: string;
}

export interface WorkflowRunPayload {
  workflow: string;
  source: unknown;
  runtime: {
    job_id: string;
    timeout_seconds: number | undefined;
    no_output_timeout_seconds: number;
  };
  ocr?: unknown;
  translation?: unknown;
  render?: unknown;
}
