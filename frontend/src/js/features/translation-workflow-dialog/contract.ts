import { APP_DIALOG_IDS } from "../../contracts/app-contract.js";

export const TRANSLATION_WORKFLOW_MODES = Object.freeze({
  UPLOAD: "upload",
  STATUS: "status",
});

export const TRANSLATION_WORKFLOW_DIALOG = {
  ids: {
    dialog: APP_DIALOG_IDS.translationWorkflow,
    title: "translation-workflow-title",
    closeButton: "translation-workflow-close-btn",
  },
  datasets: {
    open: "open",
  },
  datasetValues: {
    open: "1",
    closed: "0",
  },
  classes: {
    hidden: "hidden",
    rootOpen: "translation-workflow-open",
    statusMode: "is-status-mode",
    uploadMode: "is-upload-mode",
  },
  copy: {
    statusTitle: "Tiến độ tác vụ",
    uploadTitle: "Thêm PDF",
    uploadDescription: "Sau khi tải lên, bạn có thể dịch ngay hoặc chỉ lưu vào thư viện.",
  },
};
