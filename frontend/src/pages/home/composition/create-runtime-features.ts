// job-runtime / recent-jobs / artifact-downloads —— Tại địa điểm: composition Giai đoạn một thời gian treo với nhau，
// Không đưa vào initialize của if Lười biếng。

import {
  API_PREFIX,
  buildJobDetailEndpoint,
  submitJson,
  fetchJobPayload,
  fetchJobEvents,
  fetchJobArtifactsManifest,
  fetchJobStageActions,
  retryJobStage,
  fetchJobList,
  fetchLibraryBookList,
  deleteLibraryBook,
  mountJobRuntimeFeature,
  mountRecentJobsFeature,
  mountArtifactDownloadsFeature,
  createArtifactDownloadsRuntimePort,
  currentJobIdFor,
  readActiveJobId,
  adaptJobStageSnapshot,
  resolveSourcePdfDownloadName,
  resolveTranslatedPdfDownloadName,
  fetchProtected,
  normalizeJobPayload,
  isTerminalStatus,
  isJobTerminal,
} from "./external.js";
import type {
  HomeBridge,
  HomeFeatures,
  HomeStatePort,
  JobRuntimeFeature,
  RecentJobsFeature,
  ArtifactDownloadsFeature,
  UploadStatePort,
} from "./types.js";
import type { RecentJobsReactViewPort } from "../features/library/types.js";

/** mountJobRuntimeFeature Cổng kết nối（Chỉ khai báo composition Khuôn mặt đến thực tế） */
type JobRuntimeShellViewPort = {
  closeDialogs: () => void;
  isReaderOpen: () => boolean;
  resetEvents: () => void;
  setCancelDisabled: (disabled: boolean) => void;
};

/** artifact-downloads viewPort cục bộ adapter */
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
  openReader: (jobId: string, anchor?: unknown) => unknown;
};

type RecentJobsNavigationPort = {
  openJob: (jobId: string) => unknown;
  openReader: (jobId: string) => unknown;
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
  const jobRuntimeFeature = mountJobRuntimeFeature({
    state: jobRuntimeState,
    apiPrefix: API_PREFIX,
    buildJobDetailEndpoint,
    fetchJobPayload,
    fetchJobEvents,
    fetchJobArtifactsManifest,
    fetchJobStageActions,
    retryJobStage,
    submitJson,
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
    // Trang chủ không còn được nhúng Đọc iframe；sync/close Dành riêng cho job-runtime Hợp đồng，Nhận ra là trống rỗng。
    onReaderDialogSync: () => {},
    onReaderDialogClose: () => {},
    uploadStatePort,
    libraryEventPort,
    shellViewPort: jobRuntimeShellViewPort,
    jobPresentationPort: { normalizeJobPayload, isTerminalStatus, isJobTerminal },
  }) as JobRuntimeFeature;

  const artifactDownloadsFeature = mountArtifactDownloadsFeature({
    state: jobRuntimeState,
    fetchProtected,
    setText: bridge.setText,
    // currentJobIdFor(state) với mặc định `() => ""` Thông số biểu mẫu Chữ ký không nhất quán，Thời Gian Chạy port sẽ đặt state Minh bạch。
    runtimePort: createArtifactDownloadsRuntimePort({
      currentJobId: (state?: unknown) => currentJobIdFor(state),
    }),
    viewPort: artifactDownloadsViewPort,
    downloadNameResolver: {
      resolveSourcePdfName: resolveSourcePdfDownloadName,
      resolveTranslatedPdfName: resolveTranslatedPdfDownloadName,
    },
  }) as ArtifactDownloadsFeature;
  artifactDownloadsFeature.bindEvents();

  // startPolling/openReader bởi jobRuntimePort/readerPort/navigationPort rót vào；Chữ ký vẫn được đánh dấu là bắt buộc。
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
