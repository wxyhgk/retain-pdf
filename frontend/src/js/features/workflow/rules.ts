export function positiveInteger(value, fallback) {
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
}: any) {
  const source = saved || {};
  return {
    workflow: normalizeWorkflow(source.workflow),
    renderSourceJobId: `${source.renderSourceJobId || ""}`.trim(),
    mathMode: normalizeMathMode(source.mathMode),
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

export function workflowNeedsUpload(workflow, constants) {
  return workflow !== constants.WORKFLOW_RENDER;
}

export function workflowNeedsCredentials(workflow, constants) {
  return workflow !== constants.WORKFLOW_RENDER;
}

export function workflowUsesRenderStage(workflow, constants) {
  return workflow === constants.WORKFLOW_BOOK || workflow === constants.WORKFLOW_RENDER;
}

export function workflowSubmitLabel(workflow, constants) {
  // Text UI: Nút chính trong dialog upload là "Dịch trực tiếp"; render vẫn dùng "Bắt đầu render"
  switch (workflow) {
    case constants.WORKFLOW_RENDER:
      return "Bắt đầu render";
    case constants.WORKFLOW_TRANSLATE:
      return "Dịch trực tiếp";
    case constants.WORKFLOW_BOOK:
      return "Dịch trực tiếp";
    default:
      return "Dịch trực tiếp";
  }
}

export function workflowHeadline(workflow, constants) {
  switch (workflow) {
    case constants.WORKFLOW_RENDER:
      return "Luồng công việc hiện tại sẽ tái sử dụng kết quả tác vụ đã có để tạo lại PDF.";
    default:
      return "Sau khi chọn PDF, bạn có thể dịch trực tiếp hoặc chỉ lưu vào giá sách.";
  }
}
