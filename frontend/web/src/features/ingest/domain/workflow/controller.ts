// workflow 域的装配根。业务按职责拆到同目录下的聚焦模块：
// - contracts.ts                端口 / 载荷共享类型（对外再导出）
// - developer-config.ts         开发者配置的默认值解析
// - workflow-mode.ts            模式解析与 UI 门禁
// - developer-dialog-controller.ts  开发者对话框的同步 / 保存 / 重置
// - payload-assembly.ts         运行载荷与文档级复用配置组装
// - glossary-options.ts         术语表选项加载（原有）
// - rules.ts / payload.ts / budget.ts / submit-controls.ts / developer-dialog.ts
//                               纯函数与端口（原有）
//
// 本文件只负责：解析顶层参数、建各 factory、拼出对外返回对象。
// 对外导出名与 import 路径保持不变（domain.ts 仍 `export *` 本文件）。

import type { CredentialGateRequest } from "./workflow-mode.js";
import { defaultWorkflowConfigPort } from "./config-port.js";
import { createGlossaryOptionsLoader } from "./glossary-options.js";
import {
  createDeveloperConfigResolver,
  resolveWorkflowDefaults,
} from "./developer-config.js";
import { createWorkflowModeController } from "./workflow-mode.js";
import { createDeveloperDialogController } from "./developer-dialog-controller.js";
import { createWorkflowPayloadAssembly } from "./payload-assembly.js";
import type {
  LoadGlossaryOptionsParams,
  WorkflowConfigPortLike,
  WorkflowConstants,
  WorkflowViewPortLike,
} from "./contracts.js";
import type { WorkflowDeveloperConfig } from "./payload.js";

export * from "./contracts.js";

export interface MountWorkflowFeatureOptions {
  configPort?: WorkflowConfigPortLike;
  saveDeveloperStoredConfig: (config?: unknown) => unknown;
  getDeepSeekBalanceState: () => {
    balanceCny?: number | null;
    balanceChecked?: boolean;
  };
  getDeveloperConfig: () => WorkflowDeveloperConfig | Record<string, unknown> | null | undefined;
  getUploadState: () => {
    uploadId?: string;
    uploadedPageCount?: number;
  };
  isDesktopMode: () => boolean;
  resetDeveloperConfig: () => void;
  setDeveloperConfig: (config: unknown) => void;
  defaultModelName: () => string;
  defaultModelBaseUrl: () => string;
  defaultPaddleApiUrl: () => string;
  defaultPaddleToken: () => string;
  defaultOcrProvider: () => string;
  defaultModelApiKey: () => string;
  defaultFileLabel?: string;
  normalizeWorkflow: (value?: unknown) => string;
  normalizeMathMode: (value?: unknown) => string;
  constants: WorkflowConstants;
  currentPageRanges: () => string;
  viewPort: WorkflowViewPortLike;
  readSubmitValues?: WorkflowViewPortLike["readSubmitValues"];
  renderPageRangeSummary: () => void;
  hasBrowserCredentials?: () => boolean;
  updateCredentialGate?: (options: CredentialGateRequest) => void;
  fetchGlossaries?: (apiPrefix?: string) => Promise<{ items?: unknown[] } | unknown>;
  apiPrefix?: string;
  setText?: (id: string, value?: string) => void;
  isOcrOnly?: () => boolean;
}

export function mountWorkflowFeature({
  configPort = defaultWorkflowConfigPort,
  saveDeveloperStoredConfig,
  getDeepSeekBalanceState,
  getDeveloperConfig,
  getUploadState,
  isDesktopMode,
  resetDeveloperConfig,
  setDeveloperConfig,
  defaultModelName,
  defaultModelBaseUrl,
  defaultPaddleApiUrl,
  defaultPaddleToken,
  defaultOcrProvider,
  defaultModelApiKey,
  defaultFileLabel = "选择 PDF",
  normalizeWorkflow,
  normalizeMathMode,
  constants,
  currentPageRanges,
  viewPort,
  readSubmitValues = viewPort.readSubmitValues,
  renderPageRangeSummary,
  hasBrowserCredentials,
  updateCredentialGate: updateCredentialGatePort,
  fetchGlossaries,
  apiPrefix,
  setText,
  isOcrOnly,
}: MountWorkflowFeatureOptions) {
  const defaults = resolveWorkflowDefaults(constants);

  function isOcrOnlyMode() {
    return Boolean(isOcrOnly?.());
  }

  const { developerConfigWithDefaults } = createDeveloperConfigResolver({
    getDeveloperConfig,
    normalizeWorkflow,
    normalizeMathMode,
    defaults,
    defaultModelName,
    defaultModelBaseUrl,
  });

  const glossaryOptionsLoader = createGlossaryOptionsLoader({
    fetchGlossaries,
    apiPrefix,
    setDeveloperGlossaryOptions: viewPort.setDeveloperGlossaryOptions,
    setText,
    getDefaultSelectedId: () => developerConfigWithDefaults().glossaryId,
  });

  async function loadGlossaryOptions({
    force = false,
    selectedId = "",
  }: LoadGlossaryOptionsParams = {}) {
    return glossaryOptionsLoader.loadGlossaryOptions({ force, selectedId });
  }

  const mode = createWorkflowModeController({
    constants,
    developerConfigWithDefaults,
    isOcrOnlyMode,
    getDeveloperConfig,
    getUploadState,
    getDeepSeekBalanceState,
    currentPageRanges,
    defaultModelBaseUrl,
    configPort,
    isDesktopMode,
    viewPort,
    renderPageRangeSummary,
    defaultFileLabel,
    normalizeWorkflow,
    hasBrowserCredentials,
    updateCredentialGatePort,
    loadGlossaryOptions,
  });

  const dialog = createDeveloperDialogController({
    getDeveloperConfig,
    developerConfigWithDefaults,
    defaults,
    defaultModelName,
    defaultModelBaseUrl,
    normalizeWorkflow,
    viewPort,
    glossaryOptionsLoader,
    loadGlossaryOptions,
    setDeveloperConfig,
    resetDeveloperConfig,
    saveDeveloperStoredConfig,
    updateDeveloperWorkflowFormState: mode.updateDeveloperWorkflowFormState,
    applyWorkflowMode: mode.applyWorkflowMode,
  });

  const payload = createWorkflowPayloadAssembly({
    constants,
    developerConfigWithDefaults,
    isOcrOnlyMode,
    currentPageRanges,
    getUploadState,
    workflowNeedsUpload: mode.workflowNeedsUpload,
    workflowUsesRenderStage: mode.workflowUsesRenderStage,
    defaultPaddleApiUrl,
    defaultOcrProvider,
    defaultPaddleToken,
    defaultModelApiKey,
    readSubmitValues,
  });

  return {
    applyWorkflowMode: mode.applyWorkflowMode,
    buildOcrJobConfig: payload.buildOcrJobConfig,
    buildTranslateJobConfig: payload.buildTranslateJobConfig,
    collectRunPayload: payload.collectRunPayload,
    currentRenderSourceJobId: mode.currentRenderSourceJobId,
    currentWorkflow: mode.currentWorkflow,
    currentBudgetState: mode.currentBudgetState,
    developerConfigWithDefaults,
    isOcrOnly: isOcrOnlyMode,
    loadGlossaryOptions,
    refreshSubmitControls: mode.refreshSubmitControls,
    resetDeveloperDialog: dialog.resetDeveloperDialog,
    saveDeveloperDialog: dialog.saveDeveloperDialog,
    syncDeveloperDialogFromState: dialog.syncDeveloperDialogFromState,
    updateCredentialGate: mode.updateCredentialGate,
    updateDeveloperWorkflowFormState: mode.updateDeveloperWorkflowFormState,
    workflowNeedsCredentials: mode.workflowNeedsCredentials,
    workflowNeedsUpload: mode.workflowNeedsUpload,
  };
}
