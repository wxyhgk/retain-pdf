import { APP_DIALOG_IDS } from "@/platform/contracts/app-contract.js";

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
    statusTitle: "任务进度",
    uploadTitle: "添加 PDF",
    uploadDescription: "上传后可直接翻译，或只收藏到书架。",
  },
};
