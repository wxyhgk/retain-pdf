// StatusDetailDialog 的 DOM 契约 id 拷贝(蓝图 §1 + §0.1)。
//
// 拷贝自 src/js/components/dialogs/status-detail-dialog-dom-contract.js(该
// 目录整体属旧自定义元素视图层,architecture-boundaries.test.mjs 的
// `/js/components/` 防回弹正则禁止 pages/** 直接 import)——CredentialsDialog
// 域已用同一手法拷贝出 credentials-dom-ids.js,这里照此处理。id 字符串逐一
// 保留,视觉基线(status-dialog-failed/status-dialog-translation)与门禁按
// 这些 id 断言,新增/改动一律不改名旧世界字符串。

export const STATUS_DETAIL_DIALOG_IDS = {
  openButton: "status-detail-btn",
  dialog: "status-detail-dialog",
  headline: {
    icon: "status-detail-head-icon",
    jobId: "status-detail-job-id",
    note: "status-detail-head-note",
    closeButton: "status-detail-close-btn",
  },
  tabs: {
    overview: "detail-tab-overview",
    failure: "detail-tab-failure",
    events: "detail-tab-events",
    translation: "detail-tab-translation",
  },
  panels: {
    overview: "detail-panel-overview",
    failure: "detail-panel-failure",
    events: "detail-panel-events",
    translation: "detail-panel-translation",
  },
  runtime: {
    currentStage: "runtime-current-stage",
    stageElapsed: "runtime-stage-elapsed",
    totalElapsed: "runtime-total-elapsed",
    retryCount: "runtime-retry-count",
    lastTransition: "runtime-last-transition",
    terminalReason: "runtime-terminal-reason",
    inputProtocol: "runtime-input-protocol",
    stageSpecVersion: "runtime-stage-spec-version",
    mathMode: "runtime-math-mode",
  },
  stageHistory: {
    list: "overview-stage-list",
    empty: "overview-stage-empty",
  },
  failure: {
    rerunButton: "failure-rerun-btn",
    rerunStatus: "failure-rerun-status",
    ocrAmbiguityButton: "failure-ocr-ambiguity-btn",
    ocrAmbiguityStatus: "failure-ocr-ambiguity-status",
    ocrAmbiguityConfirm: "failure-ocr-ambiguity-confirm",
    ocrBindButton: "failure-ocr-bind-btn",
    ocrBindDialog: "failure-ocr-bind-dialog",
    queueCard: "failure-queue-card",
    queueCountdown: "failure-queue-countdown",
    retryOcrButton: "failure-retry-ocr-btn",
    copyTraceButton: "failure-copy-trace-btn",
    traceFeedback: "failure-trace-feedback",
    switchProviderButton: "failure-switch-provider-btn",
    preservation: "failure-preservation",
    summary: "failure-summary",
    category: "failure-category",
    stage: "failure-stage",
    rootCause: "failure-root-cause",
    suggestion: "failure-suggestion",
    lastLogLine: "failure-last-log-line",
    logButton: "failure-log-btn",
    logDialog: "failure-log-dialog",
    logContent: "failure-log-content",
    copyLogButton: "failure-copy-log-btn",
    copyLogStatus: "failure-copy-log-status",
    retryable: "failure-retryable",
  },
  events: {
    status: "events-status",
    empty: "events-empty",
    list: "events-list",
  },
  translation: {
    debugStatus: "translation-debug-status",
    debugEmpty: "translation-debug-empty",
    debugContent: "translation-debug-content",
    countTranslated: "translation-count-translated",
    countPartiallyTranslated: "translation-count-partially-translated",
    countKeptOrigin: "translation-count-kept-origin",
    countFailed: "translation-count-failed",
    providerFamily: "translation-provider-family",
    listFilter: "translation-list-filter",
    filterFinalStatus: "translation-filter-final-status",
    filterQuery: "translation-filter-query",
    filterApply: "translation-filter-apply",
    itemsMeta: "translation-items-meta",
    itemsLoading: "translation-items-loading",
    itemsEmpty: "translation-items-empty",
    itemsList: "translation-items-list",
    itemsPrev: "translation-items-prev",
    itemsPage: "translation-items-page",
    itemsNext: "translation-items-next",
    itemMeta: "translation-item-meta",
    itemLoading: "translation-item-loading",
    itemEmpty: "translation-item-empty",
    itemDetail: "translation-item-detail",
    itemReplay: "translation-item-replay",
    replayStatus: "translation-replay-status",
    replayResult: "translation-replay-result",
  },
};

// 拷贝自 src/js/contracts/download-action-contract.js 的 MARKDOWN_BUNDLE id
// (该文件不在防回弹禁区,但概览面板下载行的 id 属 StatusDetailDialog 自身
// 模板契约,和 status-card-dom-ids.js 的 STATUS_MARKDOWN_BUNDLE 是两个不同的
// 物理 id,不冲突——直接内联避免多一层 re-export)。
export const STATUS_DETAIL_MARKDOWN_BUNDLE_ID = "markdown-bundle-btn";
