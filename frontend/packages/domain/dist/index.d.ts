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
export { buildJobWarningViewModel, buildWorkflowSectionsViewModel, } from "./job/workflow-visibility-view-model.js";
export { normalizeJobPayload } from "./job/normalize.js";
export { summarizeStatus } from "./job/diagnostics.js";
export { isJobTerminal, isTerminalStatus } from "./job/core.js";
export { resolveSourcePdfDownloadName, resolveTranslatedPdfDownloadName, } from "./job/artifacts.js";
export { resolveJobActions } from "./job/actions.js";
export { buildElapsedViewModel } from "./job/elapsed-view-model.js";
export { resolveStageHistory, resolveStageHistoryDuration, stageHistoryDisplay, } from "./job/stage-history.js";
export { adaptJobStageSnapshot } from "./job-status/job-stage-contract-adapter.js";
export { normalizedStageEventRecord } from "./job-status/job-stage-event-record.js";
export { buildJobStatusSummaryViewModel } from "./job-status/job-status-summary-view-model.js";
export { buildSelectedStageDisplay } from "./job-status/selected-stage-display-view-model.js";
export { STATUS_STAGE_FLOW, STATUS_STAGE_LABELS, isSelectableStatusStage, resolveSelectedStatusStage, statusStageIndex, statusStageLabel, } from "./job-status/stage-flow-model.js";
export { buildProgressOptions, shouldAnimateRenderPageProgress, } from "./job-status/status-card-progress-view-model.js";
export { buildRuntimeStatusCardSnapshot } from "./job-status/status-card-runtime-source.js";
export { buildSubstageViewModel } from "./job-status/substage-view-model.js";
export { currentStageProgressViewModel } from "./job-status/stage-progress-view-model.js";
export { createArtifactRuntimePort, defaultArtifactRuntimePort } from "./job/artifact-runtime-port.js";
export { createArtifactUrlConfigPort, defaultArtifactUrlConfigPort } from "./job/artifact-url-config.js";
