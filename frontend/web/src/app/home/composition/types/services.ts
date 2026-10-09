// services：Bridge/Core/Domains/Views/Stores 装配面（对外 HomeServices bag）。
import type { DialogStore } from "@/platform/store/dialog-store.js";
import type { HomeStatePort } from "@/platform/contracts/home-view-contract.js";
import type { CredentialsStatePort } from "@/features/credentials/index.js";
import type { UploadStatePort } from "@/features/ingest/domain.js";
import type { ArtifactDownloadBusyStore } from "@/features/artifacts/index.js";
import type {
  CollectionRecord,
  CollectionsController,
} from "@/features/collections/index.js";
import type {
  LibraryCardItem,
  LibraryController,
  RecentJobsReactViewPort,
} from "@/features/library/index.js";
import type {
  AppStore,
  AsyncFn,
  ReadOnlyStore,
} from "./common.js";
import type {
  AppUpdateFeature,
  BrowserCredentialsFeature,
  HomeFeatures,
} from "./features.js";
import type {
  AppUpdateViewBag,
  CredentialsViewBag,
  GlossariesFeature,
  GlossariesViewBag,
  HomeAppUpdate,
  HomeCredentials,
  HomeGlossaries,
  HomeSettingsHub,
} from "./credentials.js";
import type {
  CollectionsReloadSignal,
  HomeBookDetail,
  HomeCollections,
  HomeLibrary,
  RecentJobActions,
} from "./library.js";
import type {
  HomeArtifactDownloads,
  HomeJobRuntime,
  HomeStatusCard,
  HomeStatusDetail,
  StatusAreaBag,
  StatusDetailController,
  StatusDetailDialogStore,
  StatusDetailStore,
} from "./status.js";
import type { HomeReader } from "./reader.js";
import type {
  DialogStatePort,
  UploadDomRefs,
  WorkflowDialogRuntime,
} from "./workflow.js";
import type { IngestWorkflowView, UploadViewStore } from "@/features/ingest/index.js";
import type { RecentJobsStatePort } from "@/features/library/index.js";

export type { CredentialsStatePort, HomeStatePort, UploadStatePort };

export type HomePorts = {
  credentialsStatePort: CredentialsStatePort;
  dialogStatePort: DialogStatePort;
  homeStatePort: HomeStatePort;
  uploadStatePort: UploadStatePort;
};

/** 仅读 stores：消费方经 useStoreSnapshot 读取，写入走 domain actions。 */
export type HomeStores = {
  dialog: ReadOnlyStore;
  homeState: ReadOnlyStore;
  statusArea: ReadOnlyStore;
  text: ReadOnlyStore;
  uploadView: UploadViewStore;
  workflowView: ReadOnlyStore;
  credentialsView: ReadOnlyStore;
};

/** Status 分域窄端口：仅 store 读侧 + 取消任务 */
export type StatusCardPort = HomeStatusCard;
/** Library 分域窄端口 */
export type LibraryPort = HomeLibrary;

/** @deprecated god-object 兼容别名，请改用按域的 Port 类型 */
export type HomeBridge = {
  setText: (id: string, value?: string) => void;
  setWorkflowSections: (job?: unknown) => void;
  updateJobWarning: (status: unknown) => void;
  resetUploadProgress: () => void;
  resetUploadedFile: () => void;
  applyWorkflowMode: () => void;
  renderPageRangeSummary: () => void;
  setSubmitBusy: (busy: boolean) => void;
  activateDetailTab: (name?: string) => void;
  submitForm: (event?: { preventDefault?: () => void } | null) => unknown;
};

/** Composition 核心：生命周期 + ports + 只读 stores */
export type HomeCoreServices = {
  bridge: HomeBridge;
  dispose: () => void;
  features: HomeFeatures;
  initialize: () => void;
  ports: HomePorts;
  stores: HomeStores;
};

/** 各域聚合（按域拆分的神对象替代） */
export type HomeDomainServices = {
  statusArea: StatusAreaBag;
  credentials: HomeCredentials;
  settingsHub: HomeSettingsHub;
  glossaries: HomeGlossaries;
  appUpdate: HomeAppUpdate;
  library: LibraryPort;
  bookDetail: HomeBookDetail;
  collections: HomeCollections;
  artifactDownloads: HomeArtifactDownloads;
  jobRuntime: HomeJobRuntime;
  statusCard: StatusCardPort;
  statusDetail: HomeStatusDetail;
  reader: HomeReader;
};

// 别名清理：statusCardPort/libraryPort 与 statusCard/library 同对象，
// uploadPort/textPort/workflowPort 与下方扁平视图别名同对象，均无消费方，已移除。
/** HomeServices = Core + Domains + 视图帮助（24 字段） */
export type HomeServices = HomeCoreServices &
  HomeDomainServices & {
    /** text-store 的 selector 帮助函数（配合 useStoreSnapshot） */
    uploadDomRefs: UploadDomRefs;
    workflowView: IngestWorkflowView;
    workflowDialog: WorkflowDialogRuntime;
  };

/** buildHomeServices 的 views 入参 */
export type HomeServicesViews = {
  textStore: {
    store: AppStore;
    setText?: (id: string, value?: string) => void;
  };
  uploadView: {
    store: UploadViewStore;
    domRefs: UploadDomRefs;
    patch: (payload: Record<string, unknown>) => unknown;
  };
  workflowView: IngestWorkflowView;
  statusArea: StatusAreaBag;
  workflowDialog: WorkflowDialogRuntime;
};

/** buildHomeServices 的 domains 入参 */
export type HomeServicesDomains = {
  credentials: {
    browserCredentialsFeature: BrowserCredentialsFeature;
    credentialsView: CredentialsViewBag;
    settingsHubDialogStore: DialogStore;
  };
  glossaries: {
    glossariesFeature: GlossariesFeature;
    glossariesView: GlossariesViewBag;
    glossariesDialogStore: DialogStore;
    appUpdateFeature: AppUpdateFeature;
    appUpdateView: AppUpdateViewBag;
  };
  appUpdate: {
    appUpdateFeature: AppUpdateFeature;
    appUpdateView: AppUpdateViewBag;
  };
  status: {
    currentJobStore: AppStore;
    secondaryResourceStore?: unknown;
    statusCardStore: AppStore;
    statusCardController?: { cancelCurrentJob: () => unknown };
    statusDetailStore: StatusDetailStore;
    statusDetailDialogStore: StatusDetailDialogStore;
    statusDetailController: StatusDetailController;
    artifactDownloadBusyStore: ArtifactDownloadBusyStore;
  };
  library: {
    recentJobsViewPort: RecentJobsReactViewPort;
    recentJobsStatePort: RecentJobsStatePort;
    recentJobActions: RecentJobActions;
    libraryController: LibraryController;
    bookDetailStore: DialogStore<LibraryCardItem | null>;
    collectionsController: CollectionsController;
    collectionManageDialogStore: DialogStore<CollectionRecord | null>;
    collectionsReloadSignal: CollectionsReloadSignal;
    recentJobsReaderPort: { openReader: HomeReader["openReader"] };
  };
};

export type CreateHomeCompositionOptions = {
  documentRef?: Document;
  fetchGlossaries?: AsyncFn;
  submitUploadRequest?: AsyncFn;
  loadPersistedDeveloperConfig?: () => Record<string, unknown>;
  loadPersistedBrowserConfig?: () => Partial<ReturnType<CredentialsStatePort["getCredentials"]>>;
  validateOcrToken?: AsyncFn | null;
  validateDeepSeekToken?: AsyncFn;
  queryDeepSeekBalance?: AsyncFn;
  createCredential?: AsyncFn;
  updateCredential?: AsyncFn;
  checkApiConnectivity?: AsyncFn | null;
  saveDesktopConfig?: AsyncFn | null;
  initialDesktopMode?: boolean;
  fetchGlossary?: AsyncFn;
  createGlossary?: AsyncFn;
  updateGlossary?: AsyncFn;
  deleteGlossary?: AsyncFn;
  exportGlossaryCsv?: AsyncFn;
  parseGlossaryCsv?: AsyncFn;
  fetchLatestRelease?: AsyncFn;
  appUpdateCachePort?: {
    read: () => { info?: unknown; fresh?: boolean };
    write?: (info: unknown) => void;
  };
  appUpdateAutoCheckEnabled?: boolean;
};
