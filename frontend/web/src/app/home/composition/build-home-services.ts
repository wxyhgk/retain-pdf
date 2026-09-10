// 组装 HomeServices 对外 bag（HomeApp / useHomeServices 消费）。
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
  UploadPort,
  TextPort,
  WorkflowPort,
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
    uploadView: views.uploadView.store as unknown as HomeServices["stores"]["uploadView"],
    workflowView: views.workflowView.store as unknown as HomeServices["stores"]["workflowView"],
    credentialsView: credentials.credentialsView.store as unknown as HomeServices["stores"]["credentialsView"],
  };

  // Domain 窄端口：业务内聚到各自工厂，composition 仅转发
  const statusCard: StatusCardPort = {
    store: status.statusCardStore as unknown as StatusCardPort["store"],
    // cancel 业务已内聚到 status 域的 statusCardController（而非在此直接调 feature）
    cancelCurrentJob: () =>
      (status as any).statusCardController?.cancelCurrentJob?.() ??
      (features.jobRuntimeFeature as any)?.cancelCurrentJob?.(),
  };

  const libraryPort: LibraryPort = {
    viewPort: library.recentJobsViewPort,
    recentJobsStore: library.recentJobsStatePort.store as unknown as LibraryPort["recentJobsStore"],
    actions: {
      ...library.recentJobActions,
      // selectJob 业务已内聚到 LibraryController（findItem 不再由 composition 拼）
      selectJob: (library.libraryController as any).selectJob
        ? (jobId: string) => (library.libraryController as any).selectJob(jobId)
        : (jobId: string) => (library.libraryController as any).selectJobForDetail(jobId, {} as any),
      openSourceReader: library.libraryController.openSourceReader,
      translateDocument: library.libraryController.translateDocument,
      ocrDocument: library.libraryController.ocrDocument,
      submitDocument: (library.libraryController as any).submitDocument,
      getDocumentJobs: library.libraryController.getDocumentJobs,
      getDocumentByJobId: library.libraryController.getDocumentByJobId,
      getJobStageActions: library.libraryController.getJobStageActions,
      retryJobStage: library.libraryController.retryJobStage,
      deleteDocument: library.libraryController.deleteDocument,
      deleteDocuments: library.libraryController.deleteDocuments,
      deleteCard: library.libraryController.deleteCard,
      openBookDetail: library.libraryController.openBookDetail,
      updateDocument: library.libraryController.updateDocument,
      storeOnly: library.libraryController.storeOnly,
      attachJobProgress: library.libraryController.attachJobProgress,
    },
  };

  const uploadPort: UploadPort = {
    domRefs: views.uploadView.domRefs,
    viewActions: { patch: views.uploadView.patch },
    store: views.uploadView.store as unknown as UploadPort["store"],
  };

  const textPort: TextPort = {
    store: views.textStore.store as unknown as TextPort["store"],
    textOf: views.textStore.textOf,
  };

  const workflowPort: WorkflowPort = {
    store: views.workflowView.store as unknown as WorkflowPort["store"],
    viewActions: {
      setSelectedGlossaryId: views.workflowView.setSelectedGlossaryId,
      setOcrOnly: (views.workflowView as any).setOcrOnly,
      isOcrOnly: (views.workflowView as any).isOcrOnly,
    } as unknown as WorkflowPort["viewActions"],
    dialog: views.workflowDialog,
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
      view: credentials.credentialsView as any,
      dialogStore: credentials.credentialsDialogStore,
    },
    settingsHub: {
      dialogStore: credentials.settingsHubDialogStore,
    },
    glossaries: {
      feature: features.glossariesFeature,
      view: glossaries.glossariesView as any,
      dialogStore: glossaries.glossariesDialogStore,
    },
    appUpdate: {
      feature: features.appUpdateFeature,
      view: appUpdate.appUpdateView as any,
      handlersRef: appUpdate.appUpdateView.handlersRef,
    },
    library: libraryPort,
    libraryPort,
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
    statusCardPort: statusCard,
    statusDetail: {
      store: status.statusDetailStore,
      dialogStore: status.statusDetailDialogStore,
      controller: status.statusDetailController,
    },
    reader: {
      openReader: library.recentJobsReaderPort.openReader,
    },
    // narrow ports
    uploadPort,
    textPort,
    workflowPort,
    textOf: views.textStore.textOf,
    uploadDomRefs: views.uploadView.domRefs,
    uploadViewActions: {
      patch: views.uploadView.patch,
    },
    workflowViewActions: {
      setSelectedGlossaryId: views.workflowView.setSelectedGlossaryId,
      setOcrOnly: (views.workflowView as any).setOcrOnly,
      isOcrOnly: (views.workflowView as any).isOcrOnly,
    } as any,
    workflowDialog: views.workflowDialog,
  } as HomeServices;
}
