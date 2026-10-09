// 组装 HomeServices：composition 的返回值，经 app 侧 toNarrowServices 映射成
// 窄口后灌给组件树；entry 与整机启动的测试也直接持有它。
// Hide Store behind read-only selectors; 业务内聚到 domain 工厂（不再在此拼闭包）。
// 装配位：末端只读features/domains/views/ports→HomeServices，不写features；
// 写者见create-home-composition顺序图；敏感读：statusCard.cancel晚绑features.jobRuntime，library.selectJob读libraryController。

import type {
  HomeBridge,
  HomeFeatures,
  HomeServices,
  HomeServicesDomains,
  HomeServicesViews,
  LibraryPort,
  StatusCardPort,
} from "./types.js";

export function buildHomeServices({
  bridge,
  features,
  initialize,
  dispose,
  ports,
  views,
  domains,
}: {
  bridge: HomeBridge;
  features: HomeFeatures;
  initialize: () => void;
  dispose: () => void;
  ports: HomeServices["ports"];
  views: HomeServicesViews;
  domains: HomeServicesDomains;
}): HomeServices {
  const {
    credentials,
    glossaries,
    appUpdate,
    status,
    library,
  } = domains;

  // 仅读 stores（对外类型隐藏 actions，运行时仍为原 store 以兼容旧测试的 actions 访问）
  const stores = {
    dialog: ports.dialogStatePort.store as unknown as HomeServices["stores"]["dialog"],
    homeState: ports.homeStatePort.store as unknown as HomeServices["stores"]["homeState"],
    statusArea: views.statusArea.store as unknown as HomeServices["stores"]["statusArea"],
    text: views.textStore.store as unknown as HomeServices["stores"]["text"],
    uploadView: views.uploadView.store,
    workflowView: views.workflowView.store as unknown as HomeServices["stores"]["workflowView"],
    credentialsView: credentials.credentialsView.store as unknown as HomeServices["stores"]["credentialsView"],
  };

  // Domain 窄端口：业务内聚到各自工厂，composition 仅转发
  const statusCard: StatusCardPort = {
    store: status.statusCardStore as unknown as StatusCardPort["store"],
    // cancel 业务已内聚到 status 域的 statusCardController（而非在此直接调 feature）
    cancelCurrentJob: () =>
      status.statusCardController?.cancelCurrentJob?.() ??
      features.jobRuntimeFeature?.cancelCurrentJob?.(),
  };

  const libraryPort: LibraryPort = {
    viewPort: library.recentJobsViewPort,
    recentJobsStore: library.recentJobsStatePort.store,
    actions: {
      ...library.recentJobActions,
      // selectJob 业务已内聚到 LibraryController（findItem 不再由 composition 拼）
      selectJob: (jobId: string) =>
        library.libraryController.selectJob
          ? library.libraryController.selectJob(jobId)
          : library.libraryController.selectJobForDetail(jobId, {}),
      openSourceReader: library.libraryController.openSourceReader,
      translateDocument: library.libraryController.translateDocument,
      ocrDocument: library.libraryController.ocrDocument,
      // submitDocument 运行时由 controller 拼入，但 LibraryController 类型尚未暴露（见报告）。
      submitDocument: library.libraryController.submitDocument,
      getDocumentJobs: library.libraryController.getDocumentJobs,
      getDocumentByJobId: library.libraryController.getDocumentByJobId,
      getJobStageActions: library.libraryController.getJobStageActions,
      retryJobStage: library.libraryController.retryJobStage,
      cancelJob: library.libraryController.cancelJob,
      deleteDocument: library.libraryController.deleteDocument,
      deleteDocuments: library.libraryController.deleteDocuments,
      deleteCard: library.libraryController.deleteCard,
      openBookDetail: library.libraryController.openBookDetail,
      updateDocument: library.libraryController.updateDocument,
      storeOnly: library.libraryController.storeOnly,
      attachJobProgress: library.libraryController.attachJobProgress,
    },
  };

  return {
    bridge,
    dispose,
    features,
    initialize,
    ports,
    stores: stores as HomeServices["stores"],
    statusArea: views.statusArea,
    credentials: {
      feature: features.browserCredentialsFeature,
      view: credentials.credentialsView,
    },
    settingsHub: {
      dialogStore: credentials.settingsHubDialogStore,
    },
    glossaries: {
      feature: features.glossariesFeature,
      view: glossaries.glossariesView,
      dialogStore: glossaries.glossariesDialogStore,
    },
    appUpdate: {
      feature: features.appUpdateFeature,
      view: appUpdate.appUpdateView,
      handlersRef: appUpdate.appUpdateView.handlersRef,
    },
    library: libraryPort,
    bookDetail: {
      dialogStore: library.bookDetailStore,
    },
    collections: {
      controller: library.collectionsController,
      dialogStore: library.collectionManageDialogStore,
      reloadSignal: library.collectionsReloadSignal,
    },
    artifactDownloads: {
      busyStore: status.artifactDownloadBusyStore,
    },
    jobRuntime: {
      store: status.currentJobStore as unknown as HomeServices["jobRuntime"]["store"],
    },
    statusCard,
    statusDetail: {
      store: status.statusDetailStore,
      dialogStore: status.statusDetailDialogStore,
      controller: status.statusDetailController,
    },
    reader: {
      openReader: library.recentJobsReaderPort.openReader,
    },
    // 视图帮助别名
    uploadDomRefs: views.uploadView.domRefs,
    // 整个对象交给 ingest 自带的 context（HomeApp 里提供），不再逐个方法对接。
    workflowView: views.workflowView,
    workflowDialog: views.workflowDialog,
  };
}
