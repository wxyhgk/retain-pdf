import { bindReaderDialogEvents } from "./reader-dialog-events.js";
import {
  closeReaderDialog,
  openReaderDialog,
  readerDialogElements,
  setReaderDialogFrameSource,
  setReaderDialogLoadingProgress,
  setReaderDialogLoadingVisible,
  setReaderDialogToolbarButtonState,
} from "./reader-dialog-rendering.js";
import { readerDialogTemplate } from "./reader-dialog-template.js";

class ReaderDialog extends HTMLElement {
  connectedCallback() {
    if (this.dataset.hydrated === "1") {
      return;
    }
    this.dataset.hydrated = "1";
    this.innerHTML = readerDialogTemplate();
  }

  dialogElement() {
    return readerDialogElements(this).dialog;
  }

  frameElement() {
    return readerDialogElements(this).frame;
  }

  setLoadingVisible(loading) {
    setReaderDialogLoadingVisible(this, loading);
  }

  setLoadingProgress({ text = "正在准备对照阅读…", percent = 0, widthPercent = null } = {}) {
    setReaderDialogLoadingProgress(this, { text, percent, widthPercent });
  }

  setToolbarButtonState(id, { enabled = false, url = "" } = {}) {
    setReaderDialogToolbarButtonState(this, id, { enabled, url });
  }

  setFrameSource(url = "about:blank") {
    setReaderDialogFrameSource(this, url);
  }

  open() {
    openReaderDialog(this);
  }

  close() {
    closeReaderDialog(this);
  }

  getFrameWindow() {
    return this.frameElement()?.contentWindow || null;
  }

  hasLoadedFrame() {
    const frame = this.frameElement();
    return Boolean(frame?.src && frame.src !== "about:blank");
  }

  bindEvents(options = {}) {
    bindReaderDialogEvents(this, options);
  }
}

if (!customElements.get("reader-dialog")) {
  customElements.define("reader-dialog", ReaderDialog);
}
