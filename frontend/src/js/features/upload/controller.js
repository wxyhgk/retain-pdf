import { $ } from "../../dom.js";

export function mountUploadFeature({
  state,
  apiBase,
  apiPrefix,
  frontMaxBytes,
  defaultFileLabel,
  collectUploadFormData,
  submitUploadRequest,
  resetUploadedFile,
  resetUploadProgress,
  setUploadProgress,
  clearFileInputValue,
  setText,
  applyWorkflowMode,
  refreshSubmitControls,
  workflowNeedsUpload,
}) {
  function normalizePageRangeValue(startValue = "", endValue = "") {
    const start = startValue.trim();
    const end = endValue.trim();
    if (!start && !end) {
      return "";
    }
    if (start && end) {
      return start === end ? start : `${start}-${end}`;
    }
    return start || end;
  }

  function currentPageRanges() {
    const applied = state.appliedPageRange || "";
    if (applied) {
      return applied;
    }
    const start = $("page-range-start")?.value || "";
    const end = $("page-range-end")?.value || "";
    return normalizePageRangeValue(start, end);
  }

  function renderPageRangeSummary() {
    const summary = $("page-range-summary");
    if (!summary) {
      return;
    }
    if (!workflowNeedsUpload()) {
      summary.classList.add("hidden");
      summary.textContent = "已选择页码：-";
      return;
    }
    const value = currentPageRanges();
    if (!value) {
      summary.classList.add("hidden");
      summary.textContent = "已选择页码：-";
      return;
    }
    summary.classList.remove("hidden");
    summary.textContent = `已选择页码：${value}`;
  }

  function openPageRangeDialog() {
    const applied = state.appliedPageRange || "";
    const [start = "", end = ""] = applied.includes("-") ? applied.split("-", 2) : [applied, applied];
    if ($("page-range-start")) {
      $("page-range-start").value = start || "";
    }
    if ($("page-range-end")) {
      $("page-range-end").value = end || "";
    }
    $("page-range-dialog")?.showModal();
  }

  function applyPageRanges() {
    const startInput = $("page-range-start");
    const endInput = $("page-range-end");
    const start = startInput?.value?.trim() || "";
    const end = endInput?.value?.trim() || "";
    if ((start && Number(start) < 1) || (end && Number(end) < 1)) {
      setText("error-box", "页码必须从 1 开始");
      return;
    }
    if (start && end && Number(start) > Number(end)) {
      setText("error-box", "起始页不能大于结束页");
      return;
    }
    if (startInput) {
      startInput.value = start;
    }
    if (endInput) {
      endInput.value = end;
    }
    state.appliedPageRange = normalizePageRangeValue(start, end);
    setText("error-box", "-");
    renderPageRangeSummary();
    $("page-range-dialog")?.close();
  }

  function clearPageRanges() {
    if ($("page-range-start")) {
      $("page-range-start").value = "";
    }
    if ($("page-range-end")) {
      $("page-range-end").value = "";
    }
    state.appliedPageRange = "";
    renderPageRangeSummary();
  }

  async function handleFileSelected() {
    const file = $("file").files[0];
    resetUploadedFile();
    resetUploadProgress();
    applyWorkflowMode();
    setText("file-label", file ? file.name : defaultFileLabel);
    if ($("file-label")) {
      $("file-label").title = file ? file.name : "";
    }
    if (!file) {
      return;
    }
    if (file.size > frontMaxBytes) {
      setText("error-box", "当前前端限制为 200MB 以内 PDF");
      setText("upload-status", "文件超出大小限制");
      $("upload-status")?.classList.remove("hidden");
      return;
    }
    setText("error-box", "-");
    setText("upload-status", "正在上传…");
    $("upload-status")?.classList.remove("hidden");

    try {
      const payload = await submitUploadRequest(
        `${apiBase()}${apiPrefix}/uploads`,
        collectUploadFormData(file),
        setUploadProgress,
      );
      state.uploadId = payload.upload_id || "";
      state.uploadedFileName = payload.filename || file.name;
      state.uploadedPageCount = Number(payload.page_count || 0);
      state.uploadedBytes = Number(payload.bytes || file.size || 0);
      $("file")?.closest(".upload-tile")?.classList.toggle("is-ready", !!state.uploadId);
      $("file")?.closest(".upload-tile")?.classList.remove("is-uploading");
      setText("upload-status", `上传完成: ${state.uploadedFileName} | ${state.uploadedPageCount} 页 | ${(state.uploadedBytes / 1024 / 1024).toFixed(2)} MB`);
      $("upload-status")?.classList.remove("hidden");
      clearFileInputValue();
      refreshSubmitControls();
    } catch (err) {
      resetUploadedFile();
      clearFileInputValue();
      setText("error-box", err.message);
      setText("upload-status", "上传失败");
      $("upload-status")?.classList.remove("hidden");
      applyWorkflowMode();
    }
  }

  return {
    applyPageRanges,
    clearPageRanges,
    currentPageRanges,
    handleFileSelected,
    normalizePageRangeValue,
    openPageRangeDialog,
    renderPageRangeSummary,
  };
}
