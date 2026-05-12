import { $ } from "./dom.js";

export function setTextView(id, value) {
  const el = $(id);
  if (el) {
    el.textContent = value;
  }
}

export function setInputValueView(id, value) {
  const el = $(id);
  if (el) {
    el.value = value;
  }
}

export function statusSectionStatus() {
  return $("status-section")?.getAttribute("data-status") || "";
}

export function setStatusView(status) {
  const normalized = status || "idle";
  $("status-section")?.setAttribute("data-status", normalized);
  const el = $("job-status");
  if (el) {
    el.textContent = normalized;
    el.className = `badge ${normalized}`;
  }
}

export function setStatusCardElapsed(value) {
  const statusCard = document.querySelector("job-status-card");
  if (statusCard?.setElapsed && !statusCard?.renderSnapshot) {
    statusCard.setElapsed(value);
    return;
  }
  setTextView("status-ring-elapsed", value);
}

export function setWorkflowSectionsView({ hasJob, processing }) {
  const shell = $("app-shell");
  $("status-section")?.classList.toggle("hidden", !hasJob);
  if (!hasJob) {
    shell?.classList.remove("processing-mode", "result-mode");
    setBackHomeVisible(false);
    return;
  }
  shell?.classList.toggle("processing-mode", processing);
  shell?.classList.toggle("result-mode", !processing);
  setBackHomeVisible(!processing);
}

export function setBackHomeVisible(visible) {
  const statusCard = document.querySelector("job-status-card");
  if (statusCard?.setBackHomeVisible && !statusCard?.renderSnapshot) {
    statusCard.setBackHomeVisible(visible);
    return;
  }
  $("back-home-btn")?.classList.toggle("hidden", !visible);
}

export function setJobWarningVisible(visible) {
  $("job-warning")?.classList.toggle("hidden", !visible);
}

export function renderStatusRingFallback({
  label,
  value,
  stageKey,
  pdfReady,
  readerReady,
}) {
  const statusCard = document.querySelector("job-status-card");
  if (statusCard?.setStagePresentation && !statusCard?.renderSnapshot) {
    statusCard.setStagePresentation({ label, value, stageKey });
  } else {
    setTextView("status-ring-label", label);
    setTextView("status-ring-value", value);
  }

  if (statusCard?.syncPrimaryActions && !statusCard?.renderSnapshot) {
    statusCard.syncPrimaryActions({ pdfReady, readerReady });
    return;
  }

  const pdfBtn = $("pdf-btn");
  const readerBtn = $("reader-btn");
  const actionRow = document.querySelector(".status-ring-downloads");
  pdfBtn?.classList.toggle("hidden", !pdfReady);
  readerBtn?.classList.toggle("hidden", !readerReady);
  actionRow?.classList.remove("hidden");
}

export function statusActionReady(id) {
  const el = $(id);
  return Boolean(el && !el.classList.contains("disabled"));
}

export function renderStatusCardSnapshot(snapshot) {
  const statusCard = document.querySelector("job-status-card");
  if (!statusCard?.renderSnapshot) {
    return false;
  }
  statusCard.renderSnapshot(snapshot);
  return true;
}

export function renderStatusDetailSnapshotView(snapshot) {
  const statusDetailDialog = document.querySelector("status-detail-dialog");
  if (!statusDetailDialog?.renderSnapshot) {
    return false;
  }
  statusDetailDialog.renderSnapshot(snapshot);
  return true;
}
