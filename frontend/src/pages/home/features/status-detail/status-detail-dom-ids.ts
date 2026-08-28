// Bản sao id hợp đồng DOM của StatusDetailDialog (bản thiết kế §1 + §0.1).
//
// Sao chép từ src/js/components/dialogs/status-detail-dialog-dom-contract.js (cả thư mục
// đó thuộc tầng view custom element cũ, regex chống hồi quy `/js/components/` của
// architecture-boundaries.test.mjs cấm pages/** import trực tiếp) — miền CredentialsDialog
// đã dùng cùng cách sao chép ra credentials-dom-ids.js, ở đây xử lý theo. Chuỗi id giữ
// từng cái, đường cơ sở thị giác (status-dialog-failed/status-dialog-translation) và cổng
// kiểm soát truy cập đều assert theo các id này, thêm/đổi đều không đổi tên chuỗi thế
// giới cũ.

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
    summary: "failure-summary",
    category: "failure-category",
    stage: "failure-stage",
    rootCause: "failure-root-cause",
    suggestion: "failure-suggestion",
    lastLogLine: "failure-last-log-line",
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

// Sao chép id MARKDOWN_BUNDLE từ src/js/contracts/download-action-contract.js (file
// đó không nằm trong vùng cấm hồi quy, nhưng id hàng tải xuống của bảng tổng quan là
// hợp đồng template của chính StatusDetailDialog, khác với STATUS_MARKDOWN_BUNDLE của
// status-card-dom-ids.js về mặt vật lý — không xung đột, nội tuyến trực tiếp tránh thêm
// một lớp re-export).
export const STATUS_DETAIL_MARKDOWN_BUNDLE_ID = "markdown-bundle-btn";
