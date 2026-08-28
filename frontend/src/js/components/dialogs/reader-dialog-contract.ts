export const READER_DIALOG_ELEMENT = {
  tagName: "reader-dialog",
  hostSelector: "reader-dialog",
};

export const READER_DIALOG_IDS = {
  dialog: "reader-dialog",
  frame: "reader-dialog-frame",
  closeButton: "reader-dialog-close-btn",
  loading: "reader-dialog-loading",
  loadingText: "reader-dialog-loading-text",
  loadingPercent: "reader-dialog-loading-percent",
  loadingBar: "reader-dialog-loading-bar",
};

export const READER_DIALOG_BUTTON_IDS = {
  source: "reader-source-download-btn",
  merged: "reader-merged-download-btn",
  translated: "reader-translated-download-btn",
};

export const READER_DIALOG_DATASETS = {
  hydrated: "hydrated",
  url: "url",
  defaultMarkup: "defaultMarkup",
};

export const READER_DIALOG_DATASET_VALUES = {
  hydrated: "1",
};

export const READER_DIALOG_CLASSES = {
  disabled: "disabled",
  hidden: "hidden",
};

export const READER_DIALOG_COPY = {
  preparing: "Đang chuẩn bị đối chiếu đọc…",
  busyGenerating: "Đang tạo…",
};

export const READER_FRAME_PLACEHOLDER = "<style>html,body{margin:0;min-height:100%;background:#f3f4f6;color:#1d1d1f}</style>";

export function readerDialogLinkOpenState(input) {
  const link = input?.currentTarget || input;
  return {
    url: `${link?.dataset?.[READER_DIALOG_DATASETS.url] || ""}`.trim(),
    disabled: Boolean(link?.disabled)
      || link?.classList?.contains(READER_DIALOG_CLASSES.disabled)
      || link?.getAttribute?.("aria-disabled") === "true",
  };
}
