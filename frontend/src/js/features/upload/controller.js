import { $ } from "../../dom.js";
import { buildApiUrl } from "../../config.js";
import { setUploadState } from "../../state.js";
import {
  clearPageRangeInputs,
  closePageRangeDialog,
  markUploadReady,
  openPageRangeDialogView,
  readPageRangeInputs,
  renderPageRangeSummary as renderPageRangeSummaryView,
  selectedUploadFile,
  setFileLabel,
  showUploadStatus,
  writePageRangeInputs,
} from "./view.js";

export function mountUploadFeature({
  state,
  apiBase,
  apiPrefix,
  frontMaxBytes,
  frontMaxPageCount,
  countPdfPages,
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
    const { start, end } = readPageRangeInputs();
    return normalizePageRangeValue(start, end);
  }

  function renderPageRangeSummary() {
    if (!workflowNeedsUpload()) {
      renderPageRangeSummaryView({ visible: false });
      return;
    }
    const value = currentPageRanges();
    renderPageRangeSummaryView({ visible: Boolean(value), value });
  }

  function openPageRangeDialog() {
    openPageRangeDialogView({
      applied: state.appliedPageRange || "",
      maxPage: frontMaxPageCount || 0,
    });
  }

  function applyPageRanges() {
    const { start: rawStart, end: rawEnd } = readPageRangeInputs();
    const start = rawStart.trim();
    const end = rawEnd.trim();
    if ((start && Number(start) < 1) || (end && Number(end) < 1)) {
      setText("error-box", "页码必须从 1 开始");
      return;
    }
    if ((start && frontMaxPageCount && Number(start) > frontMaxPageCount) || (end && frontMaxPageCount && Number(end) > frontMaxPageCount)) {
      setText("error-box", `页码不能超过 ${frontMaxPageCount}`);
      return;
    }
    if (start && end && Number(start) > Number(end)) {
      setText("error-box", "起始页不能大于结束页");
      return;
    }
    if (frontMaxPageCount && start && end && Number(end) - Number(start) + 1 > frontMaxPageCount) {
      setText("error-box", `页码区间不能超过 ${frontMaxPageCount} 页`);
      return;
    }
    writePageRangeInputs({ start, end });
    state.appliedPageRange = normalizePageRangeValue(start, end);
    setText("error-box", "-");
    renderPageRangeSummary();
    refreshSubmitControls();
    closePageRangeDialog();
  }

  function clearPageRanges() {
    clearPageRangeInputs();
    state.appliedPageRange = "";
    renderPageRangeSummary();
    refreshSubmitControls();
  }

  async function handleFileSelected() {
    const file = selectedUploadFile();
    resetUploadedFile();
    resetUploadProgress();
    state.appliedPageRange = "";
    renderPageRangeSummary();
    applyWorkflowMode();
    setFileLabel(file, defaultFileLabel);
    if (!file) {
      return;
    }
    if (file.size > frontMaxBytes) {
      setText("error-box", "当前前端限制为 100MB 以内 PDF");
      showUploadStatus("文件超出大小限制");
      return;
    }
    if (frontMaxPageCount && countPdfPages) {
      showUploadStatus("正在校验页数…");
      try {
        const localPageCount = await countPdfPages(file);
        if (!Number.isFinite(localPageCount) || localPageCount <= 0) {
          setText("error-box", "PDF 解析失败，请检查文件是否损坏或可访问性异常。");
          showUploadStatus("文件校验失败");
          clearFileInputValue();
          return;
        }
        if (localPageCount > frontMaxPageCount) {
          setText("error-box", `PDF 页数超过限制：最多 ${frontMaxPageCount} 页`);
          showUploadStatus("文件超出页数限制");
          clearFileInputValue();
          return;
        }
      } catch (err) {
        setText("error-box", err?.message || "PDF 解析失败，请稍后重试。");
        showUploadStatus("文件校验失败");
        clearFileInputValue();
        return;
      }
    }
    setText("error-box", "-");
    showUploadStatus("正在上传…");

    try {
      const uploadUrl = buildApiUrl(apiPrefix, "uploads");
      const payload = await submitUploadRequest(
        uploadUrl,
        collectUploadFormData(file),
        setUploadProgress,
      );
      const uploadedPageCount = Number(payload.page_count || 0);
      if (frontMaxPageCount > 0 && uploadedPageCount > frontMaxPageCount) {
        setText("error-box", `PDF 页数超过限制：最多 ${frontMaxPageCount} 页`);
        showUploadStatus("文件超出页数限制");
        clearFileInputValue();
        resetUploadedFile();
        return;
      }
      setUploadState(state, {
        uploadId: payload.upload_id || "",
        uploadedFileName: payload.filename || file.name,
        uploadedPageCount,
        uploadedBytes: Number(payload.bytes || file.size || 0),
      });
      markUploadReady(!!state.uploadId);
      showUploadStatus("上传完成，可以开始任务。");
      clearFileInputValue();
      refreshSubmitControls();
    } catch (err) {
      resetUploadedFile();
      clearFileInputValue();
      setText("error-box", err.message);
      showUploadStatus("上传失败");
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
