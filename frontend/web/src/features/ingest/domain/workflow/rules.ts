import type { WorkflowConstants } from "./contracts.js";
import type { WorkflowConfigDefaults } from "./developer-config.js";
import type { WorkflowDeveloperConfig } from "./payload.js";

export function positiveInteger(value: unknown, fallback: unknown): number {
  const fallbackNumber = Number(fallback);
  const normalizedFallback = Number.isFinite(fallbackNumber) && fallbackNumber > 0
    ? Math.floor(fallbackNumber)
    : 1;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return normalizedFallback;
  }
  return Math.floor(number);
}

export function buildDeveloperConfigWithDefaults({
  saved,
  normalizeWorkflow,
  normalizeMathMode,
  defaults,
  defaultModelName,
  defaultModelBaseUrl,
}: {
  saved: WorkflowDeveloperConfig | Record<string, unknown> | null | undefined;
  normalizeWorkflow: (value?: unknown) => string;
  normalizeMathMode: (value?: unknown) => string;
  defaults: WorkflowConfigDefaults;
  defaultModelName: () => string;
  defaultModelBaseUrl: () => string;
}): WorkflowDeveloperConfig & { workflow: string } {
  const source: Partial<WorkflowDeveloperConfig> = saved || {};
  return {
    workflow: normalizeWorkflow(source.workflow),
    translationProvider: `${source.translationProvider || ""}`.trim(),
    translationProfiles: source.translationProfiles && typeof source.translationProfiles === "object"
      ? source.translationProfiles
      : {},
    renderSourceJobId: `${source.renderSourceJobId || ""}`.trim(),
    // normalizeMathMode 的上游实现已归一到 TRANSLATION_MATH_MODES 两个值，这里收窄到契约类型。
    mathMode: normalizeMathMode(source.mathMode) as WorkflowDeveloperConfig["mathMode"],
    model: source.model || defaultModelName(),
    baseUrl: source.baseUrl || defaultModelBaseUrl(),
    glossaryId: `${source.glossaryId || source.glossary_id || ""}`.trim(),
    workers: positiveInteger(source.workers, defaults.workers),
    batchSize: positiveInteger(source.batchSize, defaults.batchSize),
    classifyBatchSize: positiveInteger(source.classifyBatchSize, defaults.classifyBatchSize),
    compileWorkers: positiveInteger(source.compileWorkers, defaults.compileWorkers),
    timeoutSeconds: positiveInteger(source.timeoutSeconds, defaults.timeoutSeconds),
    translateTitles: source.translateTitles !== false,
  };
}

export function workflowNeedsUpload(workflow: string | undefined, constants: WorkflowConstants) {
  return workflow !== constants.WORKFLOW_RENDER;
}

export function workflowNeedsCredentials(workflow: string | undefined, constants: WorkflowConstants) {
  return workflow !== constants.WORKFLOW_RENDER;
}

export function workflowUsesRenderStage(workflow: string | undefined, constants: WorkflowConstants) {
  return workflow === constants.WORKFLOW_BOOK || workflow === constants.WORKFLOW_RENDER;
}

export function workflowSubmitLabel(workflow: string | undefined, constants: WorkflowConstants) {
  // UI 文案：上传弹窗主按钮「直接翻译」；render 仍用「开始渲染」
  switch (workflow) {
    case constants.WORKFLOW_RENDER:
      return "开始渲染";
    case constants.WORKFLOW_TRANSLATE:
      return "直接翻译";
    case constants.WORKFLOW_BOOK:
      return "直接翻译";
    default:
      return "直接翻译";
  }
}

export function workflowHeadline(workflow: string | undefined, constants: WorkflowConstants) {
  switch (workflow) {
    case constants.WORKFLOW_RENDER:
      return "当前工作流会复用已有任务产物重新生成 PDF。";
    default:
      return "选择 PDF 后，可选择仅收藏、仅 OCR 或翻译。";
  }
}
