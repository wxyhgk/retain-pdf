export function buildDeveloperConfigFromDialog({
  currentConfig,
  values,
  normalizeWorkflow,
}) {
  return {
    workflow: normalizeWorkflow(values.workflow),
    renderSourceJobId: values.renderSourceJobId,
    mathMode: currentConfig.mathMode,
    model: values.model,
    baseUrl: values.baseUrl,
    targetLanguage: values.targetLanguage || currentConfig.targetLanguage || "",
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
}) {
  return {
    model: defaultModelName(),
    baseUrl: defaultModelBaseUrl(),
    targetLanguage: defaults.targetLanguage || "",
    workers: defaults.workers,
    batchSize: defaults.batchSize,
    classifyBatchSize: defaults.classifyBatchSize,
    compileWorkers: defaults.compileWorkers,
    timeoutSeconds: defaults.timeoutSeconds,
  };
}
