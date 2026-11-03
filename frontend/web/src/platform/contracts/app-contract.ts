// 调度分工表（跨域刷新/轮询/释放归属，不另设“总调度”）：
//   书架刷新 —— features/library/domain/recent-jobs/refresh-scheduler.ts
//     （防抖/节流/挂起/force 粘滞；经下方 library* 事件进入）
//   任务轮询 —— features/jobs/domain/runtime/（controller + runtime-polling-state，
//     失败指数退避 1s→15s 封顶，不可见暂停；成功清错）
//   装配顺序与释放 —— app/home/composition/create-*.ts + create-lifecycle.ts
//     （dispose 逆序：workflowDialog 事件 → document 事件 → recent-jobs 定时器/
//     loader/active-refresh → artifacts → jobRuntime.stopPolling）
//   提交兜底 —— ingest/domain/actions/submit-flow.ts publishSubmitSuccess
//     （800ms/5s 两路，返回取消函数）
// 事件契约（P=生产者，C=消费者；document CustomEvent）。
// openBrowserCredentials: P UploadTile/desktop → C SettingsDialogSlot(useAppEvent) → 设置中心 API 区
// returnHome: P status-area.returnHome → C create-lifecycle → jobRuntime.returnToHome
// retryStage: P StageRetry/StatusCardEmbedded → C create-lifecycle → jobRuntime.retryStage
// statusAreaVisibilityChanged: P status-area.setVisible → C recent-jobs/bindings + workflow-dialog-runtime
// libraryJobCreated/Updated/RefreshRequested: P library-event-port → C recent-jobs/bindings；
//   libraryJobUpdated 另被 ReaderNavigation(useAppEvent)消费
// open/closeTranslationWorkflow: P dialog-runtime/navigation-port/submit-flow/library-controller →
//   C recent-jobs/bindings + dialog-runtime 自身（close 先写 data-open，见 composition 注释）
// openReaderRequested: P library-domain/library-controller/FavoritesView/library-search →
//   C ReaderNavigation(useAppEvent)
// 已删 submitBusyChanged（原 P app-actions/view.setSubmitBusy，0 消费者，连带 dispatch 与测试期望一起删）。
// 注意：retainpdf:credentials-changed（裸串，非本表成员）不可删，desktop  bundles 门禁要求其存在。
export const APP_EVENTS = {
  openBrowserCredentials: "retainpdf:open-browser-credentials",
  returnHome: "retainpdf:return-home",
  retryStage: "retainpdf:retry-stage",
  statusAreaVisibilityChanged: "retainpdf:status-area-visibility-changed",
  libraryJobCreated: "retainpdf:library-job-created",
  libraryJobUpdated: "retainpdf:library-job-updated",
  libraryRefreshRequested: "retainpdf:library-refresh-requested",
  openTranslationWorkflow: "retainpdf:open-translation-workflow",
  closeTranslationWorkflow: "retainpdf:close-translation-workflow",
  openReaderRequested: "retainpdf:open-reader-requested",
};

export const APP_DIALOG_IDS = {
  recentJobs: "query-dialog",
  developerAuth: "developer-auth-dialog",
  developerSettings: "developer-dialog",
  glossaryManager: "glossary-manager-dialog",
  browserCredentials: "browser-credentials-dialog",
  professionalTranslation: "page-range-dialog",
  appSettings: "app-settings-dialog",
  statusDetail: "status-detail-dialog",
  reader: "reader-dialog",
  translationWorkflow: "translation-workflow-dialog",
};

export const APP_SHELL_IDS = {
  fileInput: "file",
  credentialGateAction: "credential-gate-action",
  jobForm: "job-form",
  pageRangeButton: "page-range-btn",
  pageRangeApplyButton: "page-range-apply-btn",
  pageRangeClearButton: "page-range-clear-btn",
  pageRangeStart: "page-range-start",
  pageRangeEnd: "page-range-end",
  cancelButton: "cancel-btn",
  openOutputButton: "open-output-btn",
  errorBox: "error-box",
  libraryAddPdfButton: "library-add-pdf-btn",
  appSettingsButton: "app-settings-btn",
};

export const APP_DIALOG_BACKDROP_IDS = [
  APP_DIALOG_IDS.recentJobs,
  APP_DIALOG_IDS.developerAuth,
  APP_DIALOG_IDS.developerSettings,
  APP_DIALOG_IDS.glossaryManager,
  APP_DIALOG_IDS.browserCredentials,
  APP_DIALOG_IDS.professionalTranslation,
  APP_DIALOG_IDS.appSettings,
  APP_DIALOG_IDS.statusDetail,
  APP_DIALOG_IDS.reader,
];
