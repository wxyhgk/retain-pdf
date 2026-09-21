/**
 * @retainpdf/domain — pure, framework-agnostic domain layer.
 *
 * Shared implementation of the former frontend/web job and job-status domains.
 * No React, no DOM, no fetch — only view-models, adapters, and formatters.
 * Purpose: share job/job-status logic across the frontend workspaces that consume it
 * (today frontend/web and frontend/packages/reader; frontend/web-react no longer exists).
 *
 * All applications consume the package through its public entry points:
 *   import { buildJobStatusSummaryViewModel } from "@retainpdf/domain";
 *   import { normalizeJobPayload } from "@retainpdf/domain/job";
 *
 * Host-specific runtime state and URL configuration are injected through ports,
 * keeping this package framework- and transport-independent.
 */

// — convenience re-exports matching composition/external/job.ts barrel —
// Note: NOT using `export * from "./job/index.js"` / `export * from "./job-status/index.js"` here
// because helpers like `numberOrNull` / `firstNonEmpty` exist in both namespaces;
// consumers should import via "@retainpdf/domain/job" or "@retainpdf/domain/job-status" for full wildcard,
// or use the explicit barrel below for the shared façade.
// job helpers
export {
  buildJobWarningViewModel,
  buildWorkflowSectionsViewModel,
} from "./job/workflow-visibility-view-model.js";
export { normalizeJobPayload } from "./job/normalize.js";
export { summarizeStatus } from "./job/diagnostics.js";
export { isJobTerminal, isTerminalStatus } from "./job/core.js";
export {
  resolveSourcePdfDownloadName,
  resolveTranslatedPdfDownloadName,
} from "./job/artifacts.js";
export { resolveJobActions } from "./job/actions.js";
export { buildElapsedViewModel } from "./job/elapsed-view-model.js";
export {
  resolveStageHistory,
  resolveStageHistoryDuration,
  stageHistoryDisplay,
} from "./job/stage-history.js";

// job-status helpers
export { adaptJobStageSnapshot } from "./job-status/job-stage-contract-adapter.js";
export { normalizedStageEventRecord } from "./job-status/job-stage-event-record.js";
export { buildJobStatusSummaryViewModel } from "./job-status/job-status-summary-view-model.js";
export { buildSelectedStageDisplay } from "./job-status/selected-stage-display-view-model.js";
export {
  STATUS_STAGE_FLOW,
  STATUS_STAGE_LABELS,
  isSelectableStatusStage,
  resolveSelectedStatusStage,
  statusStageIndex,
  statusStageLabel,
} from "./job-status/stage-flow-model.js";
export {
  buildProgressOptions,
  shouldAnimateRenderPageProgress,
} from "./job-status/status-card-progress-view-model.js";
export { buildRuntimeStatusCardSnapshot } from "./job-status/status-card-runtime-source.js";
export { buildSubstageViewModel } from "./job-status/substage-view-model.js";

// — library domain: 已删除，不要再加回来 —
// 曾经有一个 ./library 入口导出 assembleTranslatePayload / friendlyTranslateError /
// friendlyDocumentDeleteError / shouldPreferTranslateTab。它是 frontend/web 的过期
// 快照：assembleTranslatePayload 停留在 mergeTranslatePayload 之前的版本，对
// 「复用 OCR 产物再翻译」的请求会丢掉 workflow/source 并保留本该删掉的 ocr 段
// ——一旦有人照文件头注释把 web 侧 alias 过来，复用翻译会退化成整本重新 OCR。
// 它当时想服务的第二个消费者 frontend/web-react 早已从仓库里移除，所以这份
// 抽取没有任何去处。这四个函数的唯一归属是
// frontend/web/src/features/library/domain/documents/。
// 防回归门禁：frontend/web/tests/architecture/domain-package-duplicate-exports.test.mjs

// — example proof-of-pattern (used in README/tests) —
export { currentStageProgressViewModel } from "./job-status/stage-progress-view-model.js";

// — host configuration ports —
export { createArtifactRuntimePort, defaultArtifactRuntimePort } from "./job/artifact-runtime-port.js";
export { createArtifactUrlConfigPort, defaultArtifactUrlConfigPort } from "./job/artifact-url-config.js";
