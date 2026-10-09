// 工作流模式解析与 UI 门禁：当前模式、是否需要上传/凭据、提交按钮状态、
// 翻译预算提示、凭据门禁、以及把模式落到上传区的 applyWorkflowMode。
//
// 所有读取都经注入的 getter（developerConfigWithDefaults / getUploadState /
// 凭据状态），不直接触碰 DOM 或全局状态。

import { isOfficialDeepSeekBaseUrl } from "@/platform/config/providers.js";
import {
  workflowHeadline as resolveWorkflowHeadline,
  workflowNeedsCredentials as resolveWorkflowNeedsCredentials,
  workflowNeedsUpload as resolveWorkflowNeedsUpload,
  workflowSubmitLabel as resolveWorkflowSubmitLabel,
  workflowUsesRenderStage as resolveWorkflowUsesRenderStage,
} from "./rules.js";
import { resolveSubmitControlState } from "./submit-controls.js";
import { resolveTranslationBudgetState } from "./budget.js";
import type { WorkflowViewPortLike } from "./contracts.js";
import type { WorkflowDeveloperConfig } from "./payload.js";
import type { WorkflowConfigPortLike } from "./contracts.js";
import type { WorkflowConstants } from "./contracts.js";

export interface CreateWorkflowModeControllerOptions {
  constants: WorkflowConstants;
  developerConfigWithDefaults: () => WorkflowDeveloperConfig;
  isOcrOnlyMode: () => boolean;
  getDeveloperConfig: () => WorkflowDeveloperConfig | Record<string, unknown> | null | undefined;
  getUploadState: () => { uploadId?: string; uploadedPageCount?: number };
  getDeepSeekBalanceState: () => { balanceCny?: number | null; balanceChecked?: boolean };
  currentPageRanges: () => string;
  defaultModelBaseUrl: () => string;
  configPort: WorkflowConfigPortLike;
  isDesktopMode: () => boolean;
  viewPort: WorkflowViewPortLike;
  renderPageRangeSummary: () => void;
  defaultFileLabel: string;
  normalizeWorkflow: (value?: unknown) => string;
  hasBrowserCredentials?: () => boolean;
  updateCredentialGatePort?: (options?: {
    workflowNeedsCredentials?: () => boolean;
    workflowNeedsUpload?: () => boolean;
    hasCredentials?: () => boolean;
    refreshSubmitControls?: () => void;
  }) => void;
  loadGlossaryOptions: () => void;
}

export function createWorkflowModeController({
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
}: CreateWorkflowModeControllerOptions) {
  const { WORKFLOW_BOOK, WORKFLOW_TRANSLATE, WORKFLOW_RENDER } = constants;
  const WORKFLOW_OCR = (constants as { WORKFLOW_OCR?: string }).WORKFLOW_OCR || "ocr";

  function currentWorkflow() {
    return developerConfigWithDefaults().workflow;
  }

  function currentRenderSourceJobId() {
    return developerConfigWithDefaults().renderSourceJobId;
  }

  function workflowNeedsUpload(workflow = currentWorkflow()) {
    return resolveWorkflowNeedsUpload(workflow, constants);
  }

  function workflowNeedsCredentials(workflow = currentWorkflow()) {
    return resolveWorkflowNeedsCredentials(workflow, constants);
  }

  function workflowUsesRenderStage(workflow = currentWorkflow()) {
    return resolveWorkflowUsesRenderStage(workflow, constants);
  }

  function workflowSubmitLabel(workflow = currentWorkflow()) {
    if (isOcrOnlyMode()) return "仅做 OCR";
    return resolveWorkflowSubmitLabel(workflow, constants);
  }

  function workflowUsesTranslation(workflow = currentWorkflow()) {
    if (isOcrOnlyMode()) return false;
    return workflow === WORKFLOW_BOOK || workflow === WORKFLOW_TRANSLATE;
  }

  function workflowHeadline(workflow = currentWorkflow()) {
    // 上传区只解释“先选择文件”这一步。当前处理模式已经由上方的
    // 分段控件明确表达，不在这里重复切换一段长短不同的说明，避免
    // 翻译 / OCR 切换时上传卡和外层 Dialog 一起发生高度抖动。
    return resolveWorkflowHeadline(workflow, constants);
  }

  function updateDeveloperWorkflowFormState() {
    const workflow = normalizeWorkflow(viewPort.readDeveloperWorkflow());
    viewPort.setDeveloperWorkflowFormState({
      workflow,
      workflowRender: WORKFLOW_RENDER,
      workflowTranslate: WORKFLOW_TRANSLATE,
    });
  }

  function currentBudgetState(workflow = currentWorkflow()) {
    if (isOcrOnlyMode()) {
      return { visible: false, blocking: false, tone: "", message: "", topUpUrl: "" };
    }
    const developerConfig = getDeveloperConfig() || {};
    const modelBaseUrl = `${
      (developerConfig as { baseUrl?: unknown }).baseUrl
      || defaultModelBaseUrl()
      || ""
    }`;
    if (!isOfficialDeepSeekBaseUrl(modelBaseUrl)) {
      return { visible: false, blocking: false, tone: "", message: "", topUpUrl: "" };
    }
    const uploadState = getUploadState();
    const balanceState = getDeepSeekBalanceState();
    return resolveTranslationBudgetState({
      pageRanges: currentPageRanges(),
      uploadedPageCount: uploadState.uploadedPageCount,
      balanceCny: balanceState.balanceCny,
      balanceChecked: balanceState.balanceChecked,
      needsTranslation: workflowNeedsUpload(workflow) && workflowUsesTranslation(workflow) && Boolean(uploadState.uploadId),
    });
  }

  function refreshSubmitControls() {
    const workflow = isOcrOnlyMode() ? WORKFLOW_OCR : currentWorkflow();
    const uploadState = getUploadState();
    const budget = currentBudgetState(workflow);
    const hasCreds = hasBrowserCredentials?.();
    const submitState = resolveSubmitControlState({
      workflow,
      isMock: configPort.isMock(),
      desktopMode: isDesktopMode(),
      uploadId: uploadState.uploadId,
      renderSourceJobId: currentRenderSourceJobId(),
      hasBrowserCredentials: Boolean(hasCreds),
      budgetBlocking: Boolean(budget.blocking),
      workflowNeedsUpload,
      workflowNeedsCredentials,
      workflowSubmitLabel,
    });
    // OCR-only 隐藏翻译预算提示
    if (isOcrOnlyMode()) {
      viewPort.renderBudgetNote({ visible: false, blocking: false, message: "", tone: "", topUpUrl: "" });
    } else {
      viewPort.renderBudgetNote(budget);
    }
    viewPort.setSubmitControls(submitState);
  }

  function updateCredentialGate() {
    if (configPort.isMock()) {
      return;
    }
    const workflow = isOcrOnlyMode() ? WORKFLOW_OCR : currentWorkflow();
    updateCredentialGatePort?.({
      workflowNeedsCredentials: () => workflowNeedsCredentials(workflow),
      workflowNeedsUpload: () => workflowNeedsUpload(workflow),
      hasCredentials: () => Boolean(hasBrowserCredentials?.()),
      refreshSubmitControls,
    });
  }

  function applyWorkflowMode() {
    const workflow = currentWorkflow();
    const needsUpload = workflowNeedsUpload(workflow);
    const showPageRangeButton = workflowNeedsUpload(workflow);
    if (configPort.isMock()) {
      viewPort.applyMockUpload({
        mockScenario: configPort.mockScenario(),
        submitLabel: workflowSubmitLabel(workflow),
        showPageRangeButton,
      });
      renderPageRangeSummary();
      updateCredentialGate();
      return;
    }
    const uploadState = getUploadState();
    viewPort.applyWorkflowUpload({
      needsUpload,
      uploadReady: Boolean(uploadState.uploadId),
      defaultFileLabel,
      headline: workflowHeadline(workflow),
      renderSourceJobId: currentRenderSourceJobId(),
    });
    renderPageRangeSummary();
    refreshSubmitControls();
    updateCredentialGate();
    void loadGlossaryOptions();
  }

  return {
    currentWorkflow,
    currentRenderSourceJobId,
    workflowNeedsUpload,
    workflowNeedsCredentials,
    workflowUsesRenderStage,
    workflowSubmitLabel,
    workflowUsesTranslation,
    workflowHeadline,
    updateDeveloperWorkflowFormState,
    currentBudgetState,
    refreshSubmitControls,
    updateCredentialGate,
    applyWorkflowMode,
  };
}
