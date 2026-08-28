// composition Cặp lớp src/js/* Xuất khẩu hài hòa。
// pages/home/features VÀ create-*.ts Cấm một lần nữa trực tiếp import ../../../js/**；Thiếu biểu tượng chỉ viết lại tài liệu。

// —— config / constants ——
export { API_PREFIX } from "../../../js/config/api-constants.js";
export {
  apiBase,
  defaultModelApiKey,
  defaultModelBaseUrl,
  defaultModelName,
  defaultOcrProvider,
  defaultPaddleApiUrl,
  defaultPaddleToken,
  isMockMode,
  isTrustedWindowMessage,
  mockScenario,
} from "../../../js/config/runtime.js";
export {
  DEFAULT_FILE_LABEL,
  FRONT_MAX_BYTES,
  FRONT_MAX_PAGE_COUNT,
} from "../../../js/config/upload-constants.js";
export {
  loadBrowserStoredConfig,
  loadDeveloperStoredConfig,
  saveBrowserStoredConfig,
  savePersistedBrowserStoredConfig,
  savePersistedDeveloperStoredConfig,
} from "../../../js/config/persisted-config.js";
export { openDesktopOutputDirectory } from "../../../js/config/desktop-persistence.js";
export { DEFAULT_MODEL_VERSION } from "../../../js/config/model-constants.js";
export {
  OCR_PROVIDER_DEFINITIONS,
  TRANSLATION_PROVIDER_DEFINITION,
} from "../../../js/config/providers.js";
export {
  DEFAULT_BATCH_SIZE,
  DEFAULT_BODY_FONT_SIZE_FACTOR,
  DEFAULT_BODY_LEADING_FACTOR,
  DEFAULT_CLASSIFY_BATCH_SIZE,
  DEFAULT_COMPILE_WORKERS,
  DEFAULT_INNER_BBOX_DENSE_SHRINK_X,
  DEFAULT_INNER_BBOX_DENSE_SHRINK_Y,
  DEFAULT_INNER_BBOX_SHRINK_X,
  DEFAULT_INNER_BBOX_SHRINK_Y,
  DEFAULT_LANGUAGE,
  DEFAULT_MODE,
  DEFAULT_PDF_COMPRESS_DPI,
  DEFAULT_RENDER_MODE,
  DEFAULT_RULE_PROFILE,
  DEFAULT_TIMEOUT_SECONDS,
  DEFAULT_TRANSLATED_PDF_NAME,
  DEFAULT_TYPST_FONT_FAMILY,
  DEFAULT_WORKERS,
} from "../../../js/config/workflow-defaults.js";

// —— state ——
export {
  createDeveloperState,
  getDeveloperConfig,
  resetDeveloperConfig,
  setDeveloperConfig,
} from "../../../js/state/developer-state.js";
export {
  createDesktopState,
  isDesktopMode,
  setDesktopConfigured,
  setDesktopMode,
} from "../../../js/state/desktop-state.js";

// —— contracts / framework ——
export { APP_EVENTS } from "../../../js/contracts/app-contract.js";
export {
  DOWNLOAD_ACTION_IDS,
  PROTECTED_ARTIFACT_SELECTOR,
} from "../../../js/contracts/download-action-contract.js";
export { createStore } from "../../../js/app-framework/store.js";
export type { Store, StoreChangeMeta } from "../../../js/app-framework/store.js";

// —— job helpers ——
export {
  buildJobWarningViewModel,
  buildWorkflowSectionsViewModel,
} from "../../../js/job/workflow-visibility-view-model.js";
export { normalizeJobPayload } from "../../../js/job/normalize.js";
export { summarizeStatus } from "../../../js/job/diagnostics.js";
export { isJobTerminal, isTerminalStatus } from "../../../js/job/core.js";
export {
  resolveSourcePdfDownloadName,
  resolveTranslatedPdfDownloadName,
} from "../../../js/job/artifacts.js";
export { resolveJobActions } from "../../../js/job/actions.js";
export { buildElapsedViewModel } from "../../../js/job/elapsed-view-model.js";
export {
  resolveStageHistory,
  resolveStageHistoryDuration,
  stageHistoryDisplay,
} from "../../../js/job/stage-history.js";
export type { JobLike, JobPayload } from "../../../js/job/types.js";

// —— job-status ——
export { adaptJobStageSnapshot } from "../../../js/job-status/job-stage-contract-adapter.js";
export { normalizedStageEventRecord } from "../../../js/job-status/job-stage-event-record.js";
export { buildJobStatusSummaryViewModel } from "../../../js/job-status/job-status-summary-view-model.js";
export { buildSelectedStageDisplay } from "../../../js/job-status/selected-stage-display-view-model.js";
export {
  STATUS_STAGE_FLOW,
  STATUS_STAGE_LABELS,
  isSelectableStatusStage,
  resolveSelectedStatusStage,
  statusStageIndex,
  statusStageLabel,
} from "../../../js/job-status/stage-flow-model.js";
export {
  buildProgressOptions,
  shouldAnimateRenderPageProgress,
} from "../../../js/job-status/status-card-progress-view-model.js";
export { buildRuntimeStatusCardSnapshot } from "../../../js/job-status/status-card-runtime-source.js";
export { buildSubstageViewModel } from "../../../js/job-status/substage-view-model.js";
export type { EventsPayload } from "../../../js/job-status/types.js";

// —— status-detail (non-feature path) ——
export { buildStatusDetailSnapshot } from "../../../js/status-detail/snapshot.js";
export {
  formatEventTimestamp,
  formatRuntimeDuration,
} from "../../../js/status-detail/utils.js";

// —— runtime ——
export { resolveLottieVendorUrl } from "../../../js/runtime/vendor-url.js";

// —— api ——
export {
  buildApiEndpoint,
  buildJobDetailEndpoint,
  fetchProtected,
  submitJson,
  submitUploadRequest as submitUploadRequestHttp,
} from "../../../js/api/http.js";
export {
  fetchJobList,
  fetchJobPayload,
} from "../../../js/api/jobs-query.js";
export { fetchJobEvents } from "../../../js/api/jobs-events.js";
export { fetchJobArtifactsManifest } from "../../../js/api/jobs-artifacts.js";
export {
  fetchJobDiagnostics,
  fetchJobStageActions,
  fetchResumePlan,
  rerunJob,
  retryJobStage,
} from "../../../js/api/jobs-actions.js";
export { submitJobRequest } from "../../../js/api/jobs-submit.js";
export {
  fetchLibraryBookList,
  deleteLibraryBook,
} from "../../../js/api/library-books.js";
export {
  fetchDocumentList,
  fetchDocument,
  translateDocument,
  deleteDocument,
  patchDocument,
} from "../../../js/api/documents.js";
export {
  listCollections,
  createCollection,
  patchCollection,
  deleteCollection,
  addDocumentsToCollection,
  removeDocumentFromCollection,
} from "../../../js/api/collections.js";
export {
  fetchFavorites,
  createFavorite,
  deleteFavorite,
} from "../../../js/api/favorites.js";
export {
  validateDeepSeekToken,
  queryDeepSeekBalance,
  validatePaddleToken,
} from "../../../js/api/providers.js";
export {
  fetchGlossaries as fetchGlossariesApi,
  fetchGlossary as fetchGlossaryApi,
  createGlossary as createGlossaryApi,
  updateGlossary as updateGlossaryApi,
  deleteGlossary as deleteGlossaryApi,
  exportGlossaryCsv as exportGlossaryCsvApi,
  parseGlossaryCsv as parseGlossaryCsvApi,
} from "../../../js/api/glossaries.js";
export {
  fetchTranslationDiagnostics,
  fetchTranslationItems,
  fetchTranslationItem,
  replayTranslationItem,
} from "../../../js/api/translation-debug.js";

// —— feature controllers / ports ——
// pages/home/features Không được trực tiếp import ../../../js/features/*；Lấy thống nhất từ tài liệu này。

// home / upload / workflow
export { createHomeStatePort, HOME_LOADING_STATES } from "../../../js/features/home/state.js";
export type { HomeStatePort } from "../../../js/features/home/state.js";
export { createUploadStatePort } from "../../../js/features/upload/state.js";
export type { UploadStatePort } from "../../../js/features/upload/state.js";
export { mountUploadFeature } from "../../../js/features/upload/controller.js";
export { countPdfPages } from "../../../js/features/upload/pdf-page-count.js";
export { collectUploadFormData } from "../../../js/features/upload/form-data.js";
export { mountWorkflowFeature } from "../../../js/features/workflow/controller.js";
export { defaultWorkflowConfigPort } from "../../../js/features/workflow/config-port.js";

// credentials / glossaries
export type { CredentialsStatePort } from "../../../js/features/credentials/state.js";
export { defaultCredentialsStatePort } from "../../../js/features/credentials/default-state-port.js";
export { readHiddenCredentialDomInputs } from "../../../js/features/credentials/hidden-input-dom-port.js";
export { createCredentialRuntimeEnvPort } from "../../../js/features/credentials/runtime-env-port.js";
export { mountBrowserCredentialsFeature } from "../../../js/features/credentials/browser.js";
export { mountGlossariesFeature } from "../../../js/features/glossaries/controller.js";

// app-update
export { mountAppUpdateFeature } from "../../../js/features/app-update/controller.js";
export {
  fetchLatestGithubRelease,
  normalizeReleaseInfo,
} from "../../../js/features/app-update/github-release.js";
export { defaultUpdateCachePort } from "../../../js/features/app-update/state.js";
export { APP_VERSION } from "../../../js/features/app-update/current-version.js";

// translation workflow dialog
export {
  TRANSLATION_WORKFLOW_DIALOG,
  TRANSLATION_WORKFLOW_MODES,
} from "../../../js/features/translation-workflow-dialog/contract.js";
export { createTranslationWorkflowDialogStatePort } from "../../../js/features/translation-workflow-dialog/state.js";
export type { TranslationWorkflowDialogStatePort } from "../../../js/features/translation-workflow-dialog/state.js";
export { createTranslationWorkflowStatusAreaPort } from "../../../js/features/translation-workflow-dialog/status-area-port.js";

// app-actions / job-runtime
export { mountAppActionsFeature } from "../../../js/features/app-actions/controller.js";
export { defaultAppActionsConfigPort } from "../../../js/features/app-actions/config-port.js";
export { createAppActionsRuntimeEnvPort } from "../../../js/features/app-actions/runtime-env-port.js";
export { mountJobRuntimeFeature } from "../../../js/features/job-runtime/controller.js";
export {
  currentJobStoreFor,
  currentJobId as currentJobIdFor,
  syncCurrentJobSnapshot,
  currentJobFinishedAt,
  createCurrentJobStatePort,
} from "../../../js/features/job-runtime/current-job-state.js";
export {
  secondaryResourceStoreFor,
  createSecondaryResourceStatePort,
} from "../../../js/features/job-runtime/secondary-resource-cache.js";
export { createJobRenderContextPort } from "../../../js/features/job-runtime/render-context.js";
export { readActiveJobId } from "../../../js/features/job-runtime/active-job-storage.js";

// recent-jobs / documents-library
export { mountRecentJobsFeature } from "../../../js/features/recent-jobs/controller.js";
export { createRecentJobsStatePort } from "../../../js/features/recent-jobs/state.js";
export { createRecentJobActions } from "../../../js/features/recent-jobs/actions.js";
export { createRecentJobsRuntimePort } from "../../../js/features/recent-jobs/job-runtime-port.js";
export { createRecentJobsReaderPort } from "../../../js/features/recent-jobs/reader-port.js";
export { createRecentJobsNavigationPort } from "../../../js/features/recent-jobs/navigation-port.js";
export { createRecentJobsLibraryRefreshPort } from "../../../js/features/recent-jobs/library-refresh-port.js";
export {
  isRecentJobActive,
  recentJobProgressPercent,
  recentJobRawImageUrls,
  recentJobStageLabel,
  recentJobStatusLabel,
  recentJobTitle,
  stageKeyForRecentJobLabel,
} from "../../../js/features/recent-jobs/card-presenter.js";
export { loadFirstRecentJobImage } from "../../../js/features/recent-jobs/image-loader.js";
export { buildRecentJobsSummaryViewModel } from "../../../js/features/recent-jobs/summary-view-model.js";
export { createDocumentLibraryResource } from "../../../js/features/documents-library/document-library-resource.js";
export { isLibraryOnlyItem } from "../../../js/features/documents-library/document-card-item.js";
export { shapeDocumentsWithBooks } from "../../../js/features/documents-library/shape-documents-with-books.js";

// artifact-downloads / app-shell
export { mountArtifactDownloadsFeature } from "../../../js/features/artifact-downloads/controller.js";
export { createArtifactDownloadsRuntimePort } from "../../../js/features/artifact-downloads/runtime-port.js";
export { initializeIdleAppView } from "../../../js/features/app-shell/idle-reset.js";
export { defaultAppShellConfigPort } from "../../../js/features/app-shell/config-port.js";

// reader-dialog
export {
  READER_DIALOG_COPY,
  READER_DIALOG_IDS,
  READER_DIALOG_MESSAGES,
  READER_FRAME_PLACEHOLDER,
} from "../../../js/features/reader-dialog/contract.js";
export {
  buildReaderDocumentPageUrl,
  buildReaderPageUrl,
  buildReaderRouteUrl,
  requestedReaderJobIdFromLocation,
} from "../../../js/features/reader-dialog/routing.js";

// status-detail (domain helpers used by pages/home/features/status-detail)
export { defaultStatusDetailConfigPort } from "../../../js/features/status-detail/config-port.js";
export {
  boolLabel,
  degradationReasonOf,
  diagnosticsOf,
  errorTypesOf,
  fallbackToOf,
  finalStatusClass,
  finalStatusLabel,
  finalStatusOf,
  normalizeRoutePath,
  pageNumberOf,
  previewText,
  routePathOf,
  stringifyPretty,
  summarizeTranslationFilter,
} from "../../../js/features/status-detail/formatters.js";
export { createStatusDetailOverviewCoordinator } from "../../../js/features/status-detail/overview-coordinator.js";
export {
  rerunCurrentJob,
  syncRerunAction,
} from "../../../js/features/status-detail/resume-actions.js";
export { createStatusDetailTranslationDataPort } from "../../../js/features/status-detail/translation-data-port.js";
export { createStatusDetailTranslationTabCoordinator } from "../../../js/features/status-detail/translation-tab-coordinator.js";
export { createTranslationState } from "../../../js/features/status-detail/translation-state.js";
