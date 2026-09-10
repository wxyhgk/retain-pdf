// job-runtime / recent-jobs / artifact-downloads —— 在 composition 阶段一次挂齐，
// 不放进 initialize 的 if 懒挂载。

import { API_PREFIX } from "@/platform/config/api-constants.js";
import {
  cancelJob,
  cancelOcrJob,
  fetchJobPayload,
  fetchJobEvents,
  fetchJobArtifactsManifest,
  fetchJobStageActions,
  retryJobStage,
  fetchJobList,
  fetchLibraryBookList,
  deleteLibraryBook,
  fetchProtected,
  fetchDocumentByJobId,
  fetchDocumentMetadataSuggestions,
  createDocumentMetadataSuggestion,
} from "@/platform/api/index.js";
// adaptJobStageSnapshot 来自 job-status，其余五个来自 job —— 两个入口。
import { adaptJobStageSnapshot } from "@retainpdf/domain/job-status";
import {
  resolveSourcePdfDownloadName,
  resolveTranslatedPdfDownloadName,
  normalizeJobPayload,
  isTerminalStatus,
  isJobTerminal,
} from "@retainpdf/domain/job";
import {
  mountJobRuntimeFeature,
  currentJobId as currentJobIdFor,
  readActiveJobId,
} from "@/features/jobs/index.js";
import {
  mountRecentJobsFeature,
  createDocumentAutoNaming,
} from "@/features/library/index.js";
import {
  createArtifactDownloadsRuntimePort,
  mountArtifactDownloadsFeature,
} from "@/features/artifacts/index.js";
import { isMockMode } from "@/platform/config/runtime.js";
import type {
  HomeBridge,
  HomeFeatures,
  HomeStatePort,
  JobRuntimeFeature,
  RecentJobsFeature,
  ArtifactDownloadsFeature,
  UploadStatePort,
} from "./types.js";
import type { RecentJobsReactViewPort } from "@/features/library/index.js";

/** mountJobRuntimeFeature 外壳端口（只声明 composition 实际传入的面） */
type JobRuntimeShellViewPort = {
  closeDialogs: () => void;
  isReaderOpen: () => boolean;
  resetEvents: () => void;
  setCancelDisabled: (disabled: boolean) => void;
};

/** artifact-downloads viewPort 局部 adapter */
type ArtifactDownloadsViewPort = {
  bindProtectedLinks: (handler: (event: Event, link: Element) => void) => void;
  isLinkDisabled: (link: Element) => boolean;
  setLinkBusy: (link: Element, busy: boolean, text?: string) => void;
};

type StatusCardPresenterPort = {
  renderMain: () => void;
  renderPatch: () => void;
};

type LibraryEventPort = {
  requestRefresh?: (opts?: unknown) => void;
};

type RecentJobsStatePort = {
  store: unknown;
  getSnapshot?: () => unknown;
  removeJobFamily?: (jobId: string) => unknown;
};

type RecentJobsRuntimePort = {
  openJob: (jobId: string) => unknown;
  currentJobId: () => string;
};

type RecentJobsReaderPort = {
  openReader: (jobId: string, anchor?: unknown, documentId?: string) => unknown;
};

type RecentJobsNavigationPort = {
  openJob: (jobId: string) => unknown;
  openReader: (jobId: string, documentId?: string) => unknown;
  recoverJob: (jobId: string) => unknown;
  currentJobId: () => string;
};

type CreateRuntimeFeaturesArgs = {
  features: HomeFeatures;
  bridge: HomeBridge;
  jobRuntimeState: Record<string, unknown>;
  statusCardPresenter: StatusCardPresenterPort;
  uploadStatePort: UploadStatePort;
  libraryEventPort: LibraryEventPort;
  jobRuntimeShellViewPort: JobRuntimeShellViewPort;
  artifactDownloadsViewPort: ArtifactDownloadsViewPort;
  recentJobsStatePort: RecentJobsStatePort;
  recentJobsViewPort: RecentJobsReactViewPort;
  recentJobsJobRuntimePort: RecentJobsRuntimePort;
  recentJobsReaderPort: RecentJobsReaderPort;
  recentJobsNavigationPort: RecentJobsNavigationPort;
  documentLibraryResource: unknown;
  homeStatePort: HomeStatePort;
};

export function createRuntimeFeatures({
  features,
  bridge,
  jobRuntimeState,
  statusCardPresenter,
  uploadStatePort,
  libraryEventPort,
  jobRuntimeShellViewPort,
  artifactDownloadsViewPort,
  recentJobsStatePort,
  recentJobsViewPort,
  recentJobsJobRuntimePort,
  recentJobsReaderPort,
  recentJobsNavigationPort,
  documentLibraryResource,
  homeStatePort,
}: CreateRuntimeFeaturesArgs): {
  jobRuntimeFeature: JobRuntimeFeature;
  recentJobsFeature: RecentJobsFeature;
  artifactDownloadsFeature: ArtifactDownloadsFeature;
} {
  const documentAutoNaming = createDocumentAutoNaming({
    fetchDocumentByJobId: (jobId) => fetchDocumentByJobId(API_PREFIX, jobId),
    fetchSuggestions: (documentId) => fetchDocumentMetadataSuggestions(API_PREFIX, documentId),
    createSuggestion: (documentId, payload) => createDocumentMetadataSuggestion(API_PREFIX, documentId, payload),
    onApplied: () => {
      libraryEventPort.requestRefresh?.({ force: true, bypassThrottle: true });
    },
    onError: (error, { jobId }) => {
      console.warn(`[document-auto-naming] ${jobId}`, error);
    },
  });
  const jobRuntimeFeature = mountJobRuntimeFeature({
    state: jobRuntimeState,
    apiPrefix: API_PREFIX,
    cancelJob,
    cancelOcrJob,
    fetchJobPayload,
    fetchJobEvents,
    fetchJobArtifactsManifest,
    fetchJobStageActions,
    retryJobStage,
    renderJob: statusCardPresenter.renderMain,
    renderJobSecondaryPatch: statusCardPresenter.renderPatch,
    setText: bridge.setText,
    setWorkflowSections: bridge.setWorkflowSections,
    resetUploadProgress: bridge.resetUploadProgress,
    resetUploadedFile: bridge.resetUploadedFile,
    applyWorkflowMode: bridge.applyWorkflowMode,
    clearPageRanges: () => features.uploadFeature.clearPageRanges(),
    updateJobWarning: bridge.updateJobWarning,
    activateDetailTab: bridge.activateDetailTab,
    // 主页不再嵌入阅读 iframe；sync/close 保留给 job-runtime 契约，实现为空。
    onReaderDialogSync: () => {},
    onReaderDialogClose: () => {},
    onJobSucceeded: isMockMode()
      ? undefined
      : (job) => documentAutoNaming.run(job),
    uploadStatePort,
    libraryEventPort,
    shellViewPort: jobRuntimeShellViewPort,
    jobPresentationPort: { normalizeJobPayload, isTerminalStatus, isJobTerminal },
  }) as JobRuntimeFeature;

  const artifactDownloadsFeature = mountArtifactDownloadsFeature({
    state: jobRuntimeState,
    fetchProtected,
    setText: bridge.setText,
    // currentJobIdFor(state) 与默认 `() => ""` 形参签名不一致，运行时 port 会把 state 透传。
    runtimePort: createArtifactDownloadsRuntimePort({
      currentJobId: (state?: unknown) => currentJobIdFor(state),
    }),
    viewPort: artifactDownloadsViewPort,
    downloadNameResolver: {
      resolveSourcePdfName: resolveSourcePdfDownloadName,
      resolveTranslatedPdfName: resolveTranslatedPdfDownloadName,
    },
  }) as ArtifactDownloadsFeature;
  const disposeArtifactDownloadsEvents = artifactDownloadsFeature.bindEvents();
  (artifactDownloadsFeature as { disposeEvents?: unknown }).disposeEvents = disposeArtifactDownloadsEvents;

  // startPolling/openReader 已由 jobRuntimePort/readerPort/navigationPort 注入；签名仍标必填。
  const recentJobsFeature = mountRecentJobsFeature({
    fetchJobList,
    fetchJobPayload,
    fetchLibraryBookList,
    deleteLibraryBook,
    apiPrefix: API_PREFIX,
    currentJobId: () => jobRuntimeFeature.currentJobId() || "",
    activeJobRecoveryPort: { readActiveJobId },
    jobRuntimePort: recentJobsJobRuntimePort,
    readerPort: recentJobsReaderPort,
    navigationPort: recentJobsNavigationPort,
    stageAdapterPort: { adaptJobStageSnapshot },
    homeStatePort,
    recentJobsStatePort,
    viewPort: recentJobsViewPort,
    libraryRefreshPort: libraryEventPort,
    libraryBooksResource: documentLibraryResource,
  }) as RecentJobsFeature;

  return { jobRuntimeFeature, recentJobsFeature, artifactDownloadsFeature };
}
