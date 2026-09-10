export function buildDeveloperConfigFromDialog({
  currentConfig,
  values,
  normalizeWorkflow,
}: any) {
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
}: any) {
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
