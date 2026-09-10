export const DOWNLOAD_ACTION_IDS = Object.freeze({
  BUNDLE: "download-btn",
  MARKDOWN_BUNDLE: "markdown-bundle-btn",
  STATUS_MARKDOWN_BUNDLE: "status-markdown-bundle-btn",
  SOURCE_PDF: "source-pdf-btn",
  PDF: "pdf-btn",
  MARKDOWN_JSON: "markdown-btn",
  MARKDOWN_RAW: "markdown-raw-btn",
});

export const PROTECTED_ARTIFACT_SELECTOR = Object.values(DOWNLOAD_ACTION_IDS)
  .map((id) => `#${id}`)
  .join(", ");
