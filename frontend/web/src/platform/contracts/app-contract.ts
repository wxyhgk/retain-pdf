// 全局 retainpdf:* 事件契约（P=生产者，C=消费者；document CustomEvent）。
// openBrowserCredentials: P UploadTile/desktop → C CredentialsDialog(useAppEvent)/credentials/view
// returnHome: P status-area.returnHome → C create-lifecycle → jobRuntime.returnToHome
// retryStage: P StageRetry/StatusCardEmbedded → C create-lifecycle → jobRuntime.retryStage
// statusAreaVisibilityChanged: P status-area.setVisible → C recent-jobs/bindings + workflow-dialog-runtime
// libraryJobCreated/Updated/RefreshRequested: P library-event-port → C recent-jobs/bindings；
//   libraryJobUpdated 另被 ReaderDialog(useAppEvent)消费
// open/closeTranslationWorkflow: P dialog-runtime/navigation-port/submit-flow/library-controller →
//   C recent-jobs/bindings + dialog-runtime 自身（close 先写 data-open，见 composition 注释）
// openReaderRequested: P library-domain/library-controller/FavoritesView/library-search →
//   C ReaderDialog(useAppEvent)
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
  aiAssistant: "ai-assistant-dialog",
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
  aiAssistantButton: "ai-assistant-btn",
  appSettingsButton: "app-settings-btn",
};

export const APP_DIALOG_BACKDROP_IDS = [
  APP_DIALOG_IDS.recentJobs,
  APP_DIALOG_IDS.developerAuth,
  APP_DIALOG_IDS.developerSettings,
  APP_DIALOG_IDS.glossaryManager,
  APP_DIALOG_IDS.browserCredentials,
  APP_DIALOG_IDS.professionalTranslation,
  APP_DIALOG_IDS.aiAssistant,
  APP_DIALOG_IDS.appSettings,
  APP_DIALOG_IDS.statusDetail,
  APP_DIALOG_IDS.reader,
];
