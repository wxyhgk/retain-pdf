export function bindReaderDialogEvents(host, {
  onClose,
  onFrameLoad,
  onSourceDownload,
  onMergedDownload,
  onTranslatedDownload,
} = {}) {
  host.querySelector("#reader-source-download-btn")?.addEventListener("click", () => onSourceDownload?.());
  host.querySelector("#reader-merged-download-btn")?.addEventListener("click", () => onMergedDownload?.());
  host.querySelector("#reader-translated-download-btn")?.addEventListener("click", () => onTranslatedDownload?.());
  host.querySelector("#reader-dialog-close-btn")?.addEventListener("click", () => onClose?.());
  host.querySelector("#reader-dialog-frame")?.addEventListener("load", () => onFrameLoad?.());
}
