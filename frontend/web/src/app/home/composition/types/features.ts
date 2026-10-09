// features：Feature 注册表（神对象 CT：10 字段）。
import type { GlossariesFeature } from "@/features/glossaries/index.js";
import type { TranslateDocumentPayload } from "@/features/library/index.js";

export type WorkflowFeature = {
  applyWorkflowMode: () => void;
  buildOcrJobConfig: (pageRanges?: string) => Record<string, unknown>;
  buildTranslateJobConfig: (pageRanges?: string) => TranslateDocumentPayload | Record<string, unknown>;
  collectRunPayload: () => unknown;
  currentRenderSourceJobId: () => string;
  currentWorkflow: () => string;
  currentBudgetState: (workflow?: string) => unknown;
  developerConfigWithDefaults: () => Record<string, unknown>;
  isOcrOnly?: () => boolean;
  loadGlossaryOptions: (options?: unknown) => unknown;
  refreshSubmitControls: () => void;
  resetDeveloperDialog: () => void;
  saveDeveloperDialog: () => unknown;
  syncDeveloperDialogFromState: () => void;
  updateCredentialGate: (options?: unknown) => void;
  updateDeveloperWorkflowFormState: () => void;
  workflowNeedsCredentials: (workflow?: string) => boolean;
  workflowNeedsUpload: (workflow?: string) => boolean;
};

export type UploadFeature = {
  applyPageRanges: () => void;
  clearPageRanges: () => void;
  constrainPageRanges: (options?: { source?: unknown }) => void;
  currentPageRanges: () => string;
  handleFileSelected: () => unknown;
  normalizePageRangeValue: (start?: unknown, end?: unknown) => string;
  openTranslationOptions: () => void;
  renderPageRangeSummary: () => void;
  resetUploadSession: () => void;
  validatePageRanges: () => boolean;
};

export type BrowserCredentialsFeature = {
  activateCredentialTab: (tabName?: string) => void;
  ensureOcrCredentialsReady: (options?: unknown) => Promise<boolean> | boolean | unknown;
  hasBrowserCredentials: () => boolean;
  hasOcrCredentials: () => boolean;
  openBrowserCredentialsDialog: (options?: unknown) => void;
  prepareCredentialsPanels: () => void;
  ready: () => Promise<unknown>;
  refreshDeepSeekBalance: (options?: unknown) => Promise<unknown> | unknown;
  setDialogStatus: (message?: string, tone?: string) => void;
  updateCredentialGate: (options?: unknown) => void;
};

export type AppUpdateFeature = {
  checkForUpdates: (options?: { manual?: boolean }) => Promise<unknown> | unknown;
};

export type AppActionsFeature = {
  checkApiConnectivity: () => Promise<unknown> | unknown;
  handleOpenOutputDir: () => unknown;
  /** React SubmitEvent 与 DOM Event 均允许 */
  submitForm: (event?: { preventDefault?: () => void } | null) => unknown;
};

export type StartPollingOptions = {
  silent?: boolean;
  publishLibrary?: boolean;
  showWorkflow?: boolean;
  seedPayload?: Record<string, unknown> | null;
  recovering?: boolean;
};

export type JobRuntimeFeature = {
  cancelCurrentJob: () => unknown;
  currentJobId: () => string;
  fetchJob: (jobId?: string) => Promise<unknown> | unknown;
  retryStage: (stage: string, options?: { jobId?: string }) => unknown;
  returnToHome: () => void;
  startPolling: (jobId: string, options?: StartPollingOptions) => unknown;
  stopPolling: () => void;
};

export type RecentJobsFeature = {
  loadRecentJobs: (options?: unknown) => Promise<unknown> | unknown;
  initializeLibraryView: () => void;
  disposeFeatureEvents?: () => void;
};

export type ArtifactDownloadsFeature = {
  /** 返回解绑函数。它由 createRuntimeFeatures 显式往上传给 lifecycle，
   *  不再猴补成对象上的 disposeEvents 字段再被 duck-type 取回。 */
  bindEvents: () => () => void;
  handleProtectedArtifactClick: (event: Event, link?: Element) => unknown;
};

/** 装配期逐步填满的 features 注册表（10 字段） */
export type HomeFeatures = {
  workflowFeature?: WorkflowFeature;
  uploadFeature?: UploadFeature;
  browserCredentialsFeature?: BrowserCredentialsFeature;
  glossariesFeature?: GlossariesFeature;
  appUpdateFeature?: AppUpdateFeature;
  appActionsFeature?: AppActionsFeature;
  jobRuntimeFeature?: JobRuntimeFeature;
  recentJobsFeature?: RecentJobsFeature;
  artifactDownloadsFeature?: ArtifactDownloadsFeature;
};
