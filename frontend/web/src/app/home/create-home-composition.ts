// home 页组合根：只做「顺序接线」，不写业务、不堆 import。
//
// 装配顺序图（13工厂）：
//  1 legacyState(developer/desktop) → 2 homeState/uploadState/credentialsState
//  → 3 textStore/uploadView/workflowView/statusArea/dialog+workflowDialog
//  → 4 bridge[读features晚绑定+statusDetailHolder] → 5 workflowAndUpload[写features.workflow/upload]
//  → 6 credentials[写browserCredentials] → 7 glossariesAndAppUpdate[写glossaries/appUpdate,内bindEvents]
//  → 8 statusDomain[写holder+jobRuntimeState] → 9 libraryDomain → 10 appActions[写appActions,读workflow/credentials/jobRuntime]
//  → ★11 workflowDialog.bindEvents()先于mount → 12 runtimeFeatures[写jobRuntime/recentJobs/artifacts,内bindEvents]
//  → 13 lifecycle[写appShell] → buildHomeServices[读features/domains→HomeServices]
// 敏感点：bindEvents先于mountRecentJobs（先写DOM data-open，否则scheduleRefresh被吞）；
// features唯一可变注册表，bridge/controller晚绑定读features；runtime一次挂齐，不进initialize懒挂。
//
// 规则：
//   1. 所有 ../../../js/* 只在 composition/external.ts
//   2. 各 create* 工厂返回自己的 bag，这里显式赋值，禁止 Object.assign(ctx)
//   3. features 是唯一可变注册表；晚绑定通过它完成
//   4. job-runtime / recent-jobs / artifacts 在 composition 阶段一次挂齐

import {
  loadBrowserStoredConfig,
  loadDeveloperStoredConfig,
} from "@/platform/config/persisted-config.js";
import { defaultOcrProvider } from "@/platform/config/runtime.js";
import {
  createDeveloperState,
  setDeveloperConfig,
  createDesktopState,
  setDesktopMode,
} from "@/platform/desktop/state.js";
import { createHomeStatePort } from "./state/home-store.js";
import {
  validateDeepSeekToken,
  queryDeepSeekBalance,
  listCredentials,
  createCredential,
  updateCredential,
  fetchGlossariesApi,
  fetchGlossaryApi,
  createGlossaryApi,
  updateGlossaryApi,
  deleteGlossaryApi,
  exportGlossaryCsvApi,
  parseGlossaryCsvApi,
  submitUploadRequestHttp,
} from "@/platform/api/index.js";
import {
  createTranslationWorkflowDialogStatePort,
  createUploadStatePort,
} from "@/features/ingest/domain.js";
import {
  defaultCredentialsStatePort,
} from "@/features/credentials/index.js";
import {
  defaultUpdateCachePort,
  fetchLatestGithubRelease,
} from "@/features/app-update/index.js";

import { createHomeTextStore } from "./state/text-store.js";
import { createUploadViewFeature } from "@/features/ingest/domain.js";
import { createWorkflowViewFeature } from "@/features/ingest/domain.js";
import { createStatusAreaFeature } from "@/features/jobs/index.js";
import { createTranslationWorkflowDialogRuntime } from "@/features/ingest/domain.js";

import { safeLoad } from "./composition/safe-load.js";
import { createBridge } from "./composition/create-bridge.js";
import { createWorkflowAndUpload } from "./composition/create-workflow-upload.js";
import { createCredentials } from "./composition/create-credentials.js";
import { createGlossariesAndAppUpdate } from "./composition/create-glossaries-app-update.js";
import { createStatusDomain } from "./composition/create-status-domain.js";
import { createLibraryDomain } from "./composition/create-library-domain.js";
import { createAppActions } from "./composition/create-app-actions.js";
import { createRuntimeFeatures } from "./composition/create-runtime-features.js";
import { createLifecycle } from "./composition/create-lifecycle.js";
import { buildHomeServices } from "./composition/build-home-services.js";
import type {
  CreateHomeCompositionOptions,
  HomeFeatures,
  HomeServices,
  StatusDetailHolder,
} from "./composition/types.js";

export type { HomeServices, HomeFeatures, CreateHomeCompositionOptions } from "./composition/types.js";

export function createHomeComposition({
  documentRef = globalThis.document,
  fetchGlossaries = fetchGlossariesApi,
  submitUploadRequest = submitUploadRequestHttp,
  loadPersistedDeveloperConfig = () => safeLoad(loadDeveloperStoredConfig, {}),
  loadPersistedBrowserConfig = () => safeLoad(loadBrowserStoredConfig, {
    ocrProvider: defaultOcrProvider(),
    ocrCredentialRef: "",
    paddleToken: "",
    translationCredentialRef: "",
    modelApiKey: "",
  }),
  validateOcrToken: validateOcrTokenOverride = null,
  validateDeepSeekToken: validateDeepSeekTokenOverride = validateDeepSeekToken,
  queryDeepSeekBalance: queryDeepSeekBalanceOverride = queryDeepSeekBalance,
  listCredentials: listCredentialsOverride = listCredentials,
  createCredential: createCredentialOverride = createCredential,
  updateCredential: updateCredentialOverride = updateCredential,
  checkApiConnectivity: checkApiConnectivityOverride = null,
  saveDesktopConfig: saveDesktopConfigOverride = null,
  initialDesktopMode = false,
  fetchGlossary: fetchGlossaryOverride = fetchGlossaryApi,
  createGlossary: createGlossaryOverride = createGlossaryApi,
  updateGlossary: updateGlossaryOverride = updateGlossaryApi,
  deleteGlossary: deleteGlossaryOverride = deleteGlossaryApi,
  exportGlossaryCsv: exportGlossaryCsvOverride = exportGlossaryCsvApi,
  parseGlossaryCsv: parseGlossaryCsvOverride = parseGlossaryCsvApi,
  fetchLatestRelease: fetchLatestReleaseOverride = fetchLatestGithubRelease,
  appUpdateCachePort: appUpdateCachePortOverride = defaultUpdateCachePort,
  appUpdateAutoCheckEnabled = false,
}: CreateHomeCompositionOptions = {}): HomeServices {
  const features: HomeFeatures = {};

  // —— 基础 state / view ——
  const legacyState = { ...createDeveloperState(), ...createDesktopState() };
  setDeveloperConfig(legacyState, loadPersistedDeveloperConfig());
  setDesktopMode(legacyState, initialDesktopMode);

  const homeStatePort = createHomeStatePort({}, { eventTarget: documentRef });
  const uploadStatePort = createUploadStatePort();
  const credentialsStatePort = defaultCredentialsStatePort;
  credentialsStatePort.setCredentials(loadPersistedBrowserConfig());

  const textStore = createHomeTextStore();
  const uploadView = createUploadViewFeature();
  const workflowView = createWorkflowViewFeature({
    uploadTilePort: uploadView.uploadTilePort,
  });
  const statusArea = createStatusAreaFeature({ documentRef });
  const dialogStatePort = createTranslationWorkflowDialogStatePort({ homeStatePort });
  const workflowDialog = createTranslationWorkflowDialogRuntime({
    dialogStatePort,
    statusAreaPort: statusArea.statusAreaPort,
    uploadSessionPort: {
      resetUploadSession: () => features.uploadFeature.resetUploadSession(),
    },
    documentRef,
  });

  // bridge 需要 statusDetail holder（后续 createStatusDomain 写入）
  const statusDetailHolder: StatusDetailHolder = { store: null, dialogStore: null };
  const bridge = createBridge({
    textStore,
    statusArea,
    workflowView,
    uploadView,
    uploadStatePort,
    features,
    statusDetail: statusDetailHolder,
  });

  // —— 各域（返回 bag，显式挂到 features） ——
  Object.assign(features, createWorkflowAndUpload({
    features,
    credentialsStatePort,
    workflowView,
    uploadView,
    uploadStatePort,
    bridge,
    legacyState,
    setText: bridge.setText,
    fetchGlossaries,
    submitUploadRequest,
  }));

  const credentials = createCredentials({
    features,
    legacyState,
    credentialsStatePort,
    uploadStatePort,
    validateOcrTokenOverride,
    validateDeepSeekTokenOverride,
    queryDeepSeekBalanceOverride,
    listCredentialsOverride,
    createCredentialOverride,
    updateCredentialOverride,
    checkApiConnectivityOverride,
    saveDesktopConfigOverride,
  });
  features.browserCredentialsFeature = credentials.browserCredentialsFeature;

  const glossaries = createGlossariesAndAppUpdate({
    features,
    fetchGlossaries,
    fetchGlossary: fetchGlossaryOverride,
    createGlossary: createGlossaryOverride,
    updateGlossary: updateGlossaryOverride,
    deleteGlossary: deleteGlossaryOverride,
    exportGlossaryCsv: exportGlossaryCsvOverride,
    parseGlossaryCsv: parseGlossaryCsvOverride,
    appUpdateAutoCheckEnabled,
    appUpdateCachePort: appUpdateCachePortOverride,
    fetchLatestRelease: fetchLatestReleaseOverride,
  });
  features.glossariesFeature = glossaries.glossariesFeature;
  features.appUpdateFeature = glossaries.appUpdateFeature;

  const status = createStatusDomain({
    features,
    documentRef,
    bridge,
    setText: bridge.setText,
    statusDetailHolder,
  });

  const library = createLibraryDomain({ features, documentRef, statusArea });

  const { appActionsFeature } = createAppActions({
    features,
    bridge,
    setText: bridge.setText,
    workflowView,
    uploadView,
    uploadStatePort,
    legacyState,
    jobRuntimeState: status.jobRuntimeState,
    statusCardPresenter: status.statusCardPresenter,
    libraryEventPort: library.libraryEventPort,
    settingsHubDialogStore: credentials.settingsHubDialogStore,
  });
  features.appActionsFeature = appActionsFeature;

  // 必须先于 recent-jobs 注册 closeTranslationWorkflow 监听：
  // recent-jobs 的 scheduleRefresh 会同步读 isWorkflowOpen(DOM data-open)；
  // 若 workflow 的 close() 还没把 data-open 写成 0，刷新会被 isSuspended 吞掉（蓝图风险 5）。
  const disposeWorkflowDialogEvents = workflowDialog.bindEvents();

  // job-runtime / recent-jobs / artifacts：一次挂齐
  Object.assign(features, createRuntimeFeatures({
    features,
    bridge,
    jobRuntimeState: status.jobRuntimeState,
    statusCardPresenter: status.statusCardPresenter,
    uploadStatePort,
    libraryEventPort: library.libraryEventPort,
    jobRuntimeShellViewPort: status.jobRuntimeShellViewPort,
    artifactDownloadsViewPort: status.artifactDownloadsViewPort,
    recentJobsStatePort: library.recentJobsStatePort,
    recentJobsViewPort: library.recentJobsViewPort,
    recentJobsJobRuntimePort: library.recentJobsJobRuntimePort,
    recentJobsReaderPort: library.recentJobsReaderPort,
    recentJobsNavigationPort: library.recentJobsNavigationPort,
    documentLibraryResource: library.documentLibraryResource,
    homeStatePort,
  }));

  const lifecycle = createLifecycle({
    features,
    bridge,
    documentRef,
    disposeWorkflowDialogEvents,
  });
  features.appShellFeature = lifecycle.appShellFeature;

  return buildHomeServices({
    bridge,
    features,
    initialize: lifecycle.initialize,
    dispose: lifecycle.dispose,
    ports: {
      credentialsStatePort,
      dialogStatePort,
      homeStatePort,
      uploadStatePort,
    },
    views: {
      textStore,
      uploadView,
      workflowView,
      statusArea,
      workflowDialog,
    },
    domains: {
      credentials,
      glossaries,
      appUpdate: glossaries,
      status,
      library,
    },
  });
}
