export function readerDialogElements(host) {
  return {
    dialog: host.querySelector("#reader-dialog"),
    frame: host.querySelector("#reader-dialog-frame"),
    loading: host.querySelector("#reader-dialog-loading"),
    loadingText: host.querySelector("#reader-dialog-loading-text"),
    loadingBar: host.querySelector("#reader-dialog-loading-bar"),
  };
}

export function setReaderDialogLoadingVisible(host, loading) {
  readerDialogElements(host).loading?.classList.toggle("hidden", !loading);
}

export function setReaderDialogLoadingProgress(host, {
  text = "正在准备对照阅读...",
  percent = 0,
  widthPercent = null,
} = {}) {
  const { loadingText, loadingBar } = readerDialogElements(host);
  if (loadingText) {
    loadingText.textContent = text;
  }
  if (loadingBar) {
    const value = widthPercent ?? percent;
    loadingBar.style.width = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
  }
}

export function setReaderDialogToolbarButtonState(host, id, { enabled = false, url = "" } = {}) {
  const button = host.querySelector(`#${id}`);
  if (!button) {
    return;
  }
  button.disabled = !enabled;
  button.dataset.url = enabled ? url : "";
}

export function setReaderDialogFrameSource(host, url = "about:blank") {
  const { frame } = readerDialogElements(host);
  if (frame) {
    frame.src = url;
  }
}

export function openReaderDialog(host) {
  readerDialogElements(host).dialog?.showModal();
}

export function closeReaderDialog(host) {
  readerDialogElements(host).dialog?.close();
}
