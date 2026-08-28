import { DOWNLOAD_ACTION_IDS } from "../../composition/external.js";

// Bản sao id hợp đồng DOM của thẻ trạng thái (bản thiết kế §2 features/status/).
//
// Sao chép từ components/status/job-status-card-dom-contract.js (file đó thuộc danh sách
// "chết, do họ StatusCard.jsx thay thế", js/components/ cấm import;
// DOWNLOAD_ACTION_IDS đến từ contracts/, không nằm trong vùng cấm, import nguyên trạng).
// Chuỗi id giữ từng cái — hợp đồng DOM smoke (bản thiết kế §0) assert theo các id này.

export const STATUS_CARD_IDS = Object.freeze({
  cancelButton: "cancel-btn",
  detailButton: "status-detail-btn",
  stageFlow: "status-stage-flow",
  ringLabel: "status-ring-label",
  ringValue: "status-ring-value",
  ringElapsed: "status-ring-elapsed",
  stageDetail: "status-stage-detail",
  stageErrorSummary: "status-stage-error-summary",
  progressBar: "status-progress-bar",
  legacyProgressBar: "job-progress-bar",
  progressText: "job-progress-text",
  progressPercent: "status-progress-percent",
  progressRing: "status-progress-ring",
  progressRingMeta: "status-progress-ring-meta",
  stageRetry: "status-stage-retry",
  markdownBundleButton: DOWNLOAD_ACTION_IDS.STATUS_MARKDOWN_BUNDLE,
  readerButton: "reader-btn",
  pdfButton: DOWNLOAD_ACTION_IDS.PDF,
  sourcePdfButton: DOWNLOAD_ACTION_IDS.SOURCE_PDF,
  legacyBundleButton: DOWNLOAD_ACTION_IDS.BUNDLE,
  legacyMarkdownRawButton: DOWNLOAD_ACTION_IDS.MARKDOWN_RAW,
  legacyMarkdownJsonButton: DOWNLOAD_ACTION_IDS.MARKDOWN_JSON,
});

export const STATUS_CARD_ACTION_IDS = Object.freeze({
  pdf: STATUS_CARD_IDS.pdfButton,
  reader: STATUS_CARD_IDS.readerButton,
  sourcePdf: STATUS_CARD_IDS.sourcePdfButton,
  markdownBundle: STATUS_CARD_IDS.markdownBundleButton,
});
