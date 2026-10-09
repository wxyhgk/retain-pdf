// features：Feature 注册表（神对象 CT：10 字段）。
import type { mountBrowserCredentialsFeature } from "@/features/credentials/index.js";
import type { mountUploadFeature, mountWorkflowFeature } from "@/features/ingest/index.js";
import type { GlossariesFeature } from "@/features/glossaries/index.js";

/** 就是工作流功能挂载出来的对象（以前手抄一份结构类型，返回值对不上）。 */
export type WorkflowFeature = ReturnType<typeof mountWorkflowFeature>;

/** 就是上传功能挂载出来的对象。 */
export type UploadFeature = ReturnType<typeof mountUploadFeature>;

/** 就是凭据功能挂载出来的那个对象。以前这里手抄了一份结构类型，和真实返回值对不上
 *  （ready 的返回值、prepareCredentialsPanels 的参数），被 ui 窄口的 any 盖住了。 */
export type BrowserCredentialsFeature = ReturnType<typeof mountBrowserCredentialsFeature>;

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
