import type { WorkflowConfigDefaults } from "./developer-config.js";
import type { WorkflowDeveloperConfig } from "./payload.js";

export function buildDeveloperConfigFromDialog({
  currentConfig,
  // 边界：values 来自 WorkflowViewPortLike.readDeveloperDialog，其返回类型在 contracts.ts 中是 unknown，
  // 收窄需要改 contracts.ts（不在本次范围），所以这里暂留 any。
  values,
  normalizeWorkflow,
}: {
  currentConfig: WorkflowDeveloperConfig;
  values: any;
  normalizeWorkflow: (value?: unknown) => string;
}): WorkflowDeveloperConfig {
  return {
    workflow: normalizeWorkflow(values.workflow),
    renderSourceJobId: values.renderSourceJobId,
    mathMode: currentConfig.mathMode,
    model: values.model,
    baseUrl: values.baseUrl,
    glossaryId: values.glossaryId,
    workers: values.workers,
    batchSize: values.batchSize,
    classifyBatchSize: values.classifyBatchSize,
    compileWorkers: values.compileWorkers,
    timeoutSeconds: values.timeoutSeconds,
    translateTitles: currentConfig.translateTitles,
  };
}

export function defaultDeveloperDialogReadOptions({
  defaultModelName,
  defaultModelBaseUrl,
  defaults,
}: {
  defaultModelName: () => string;
  defaultModelBaseUrl: () => string;
  defaults: WorkflowConfigDefaults;
}) {
  return {
    model: defaultModelName(),
    baseUrl: defaultModelBaseUrl(),
    workers: defaults.workers,
    batchSize: defaults.batchSize,
    classifyBatchSize: defaults.classifyBatchSize,
    compileWorkers: defaults.compileWorkers,
    timeoutSeconds: defaults.timeoutSeconds,
  };
}
