import { $ } from "../../dom.js";
import { resetUploadState } from "../../state.js";

export function setSubmitBusy(busy) {
  const button = $("submit-btn");
  if (button) {
    button.disabled = !!busy;
  }
}

export function resetMissingUploadState({ state, resetUploadedFile, setText }) {
  resetUploadState(state, { includePageRange: false });
  resetUploadedFile?.();
  setText("error-box", "当前上传文件已失效，请重新上传 PDF 后再提交。");
}
