import { $ } from "../../dom.js";

export function readPageRangeInputs() {
  return {
    start: $("page-range-start")?.value || "",
    end: $("page-range-end")?.value || "",
  };
}

export function renderPageRangeSummary({ visible, value = "" } = {}) {
  const summary = $("page-range-summary");
  if (!summary) {
    return;
  }
  if (!visible || !value) {
    summary.classList.add("hidden");
    summary.textContent = "已选择页码：-";
    return;
  }
  summary.classList.remove("hidden");
  summary.textContent = `已选择页码：${value}`;
}

export function openPageRangeDialogView({ applied = "", maxPage = 0 } = {}) {
  const [start = "", end = ""] = applied.includes("-") ? applied.split("-", 2) : [applied, applied];
  const limitText = $("page-range-limit-text");
  const titleEl = $("page-range-title");
  if (maxPage > 0) {
    if (limitText) {
      limitText.textContent = `按页码范围限制本次翻译（最多 ${maxPage} 页，页码从 1 开始）。`;
    }
    if (titleEl) {
      titleEl.textContent = `分页翻译（最多 ${maxPage} 页）`;
    }
  } else {
    if (limitText) {
      limitText.textContent = "按页码范围限制本次翻译，页码从 1 开始。";
    }
    if (titleEl) {
      titleEl.textContent = "分页翻译";
    }
  }
  if (maxPage > 0) {
    $("page-range-start")?.setAttribute("max", String(maxPage));
    $("page-range-end")?.setAttribute("max", String(maxPage));
  }
  if ($("page-range-start")) {
    $("page-range-start").value = start || "";
  }
  if ($("page-range-end")) {
    $("page-range-end").value = end || "";
  }
  $("page-range-dialog")?.showModal();
}

export function writePageRangeInputs({ start = "", end = "" } = {}) {
  if ($("page-range-start")) {
    $("page-range-start").value = start;
  }
  if ($("page-range-end")) {
    $("page-range-end").value = end;
  }
}

export function closePageRangeDialog() {
  $("page-range-dialog")?.close();
}

export function clearPageRangeInputs() {
  writePageRangeInputs({ start: "", end: "" });
}

export function selectedUploadFile() {
  return $("file")?.files?.[0] || null;
}

export function setFileLabel(file, defaultFileLabel) {
  const label = $("file-label");
  if (!label) {
    return;
  }
  label.textContent = file ? file.name : defaultFileLabel;
  label.title = file ? file.name : "";
}

export function showUploadStatus(message) {
  const status = $("upload-status");
  if (!status) {
    return;
  }
  status.textContent = message;
  status.classList.remove("hidden");
}

export function markUploadReady(ready) {
  const tile = $("file")?.closest(".upload-tile");
  tile?.classList.toggle("is-ready", !!ready);
  tile?.classList.remove("is-uploading");
}
