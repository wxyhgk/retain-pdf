export function setHeadline(host, { iconMarkup = "", jobId = "-", note = "查看任务概览、失败原因与事件流" } = {}) {
  const icon = host.querySelector("#status-detail-head-icon");
  const jobIdEl = host.querySelector("#status-detail-job-id");
  const noteEl = host.querySelector("#status-detail-head-note");
  if (icon) {
    icon.innerHTML = iconMarkup;
  }
  if (jobIdEl) {
    jobIdEl.textContent = jobId;
  }
  if (noteEl) {
    noteEl.textContent = note;
  }
}

export function renderStageHistory(host, { markup = "", emptyText = "暂无阶段记录", hasItems = false } = {}) {
  const list = host.querySelector("#overview-stage-list");
  const empty = host.querySelector("#overview-stage-empty");
  if (!list || !empty) {
    return;
  }
  if (!hasItems) {
    list.innerHTML = "";
    list.classList.add("hidden");
    empty.textContent = emptyText;
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  list.classList.remove("hidden");
  list.innerHTML = markup;
}

export function renderEvents(host, { markup = "", count = 0, emptyText = "暂无事件", hasItems = false } = {}) {
  const list = host.querySelector("#events-list");
  const empty = host.querySelector("#events-empty");
  const status = host.querySelector("#events-status");
  if (!list || !empty || !status) {
    return;
  }
  status.textContent = hasItems ? `最近 ${count} 条` : "暂无事件";
  if (!hasItems) {
    list.innerHTML = "";
    list.classList.add("hidden");
    empty.textContent = emptyText;
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  list.classList.remove("hidden");
  list.innerHTML = markup;
}

export function setRuntimeDetails(host, details = {}) {
  const entries = [
    ["runtime-current-stage", details.currentStage],
    ["runtime-stage-elapsed", details.stageElapsed],
    ["runtime-total-elapsed", details.totalElapsed],
    ["runtime-retry-count", details.retryCount],
    ["runtime-last-transition", details.lastTransition],
    ["runtime-terminal-reason", details.terminalReason],
    ["runtime-input-protocol", details.inputProtocol],
    ["runtime-stage-spec-version", details.stageSpecVersion],
    ["runtime-math-mode", details.mathMode],
  ];
  entries.forEach(([id, value]) => {
    const el = host.querySelector(`#${id}`);
    if (el) {
      el.textContent = value ?? "-";
    }
  });
}

export function setFailureDetails(host, details = {}) {
  const entries = [
    ["failure-summary", details.summary],
    ["failure-category", details.category],
    ["failure-stage", details.stage],
    ["failure-root-cause", details.rootCause],
    ["failure-suggestion", details.suggestion],
    ["failure-last-log-line", details.lastLogLine],
    ["failure-retryable", details.retryable],
  ];
  entries.forEach(([id, value]) => {
    const el = host.querySelector(`#${id}`);
    if (el) {
      el.textContent = value ?? "-";
    }
  });
}

export function setRerunAction(host, { enabled = false, status = "" } = {}) {
  const button = host.querySelector("#failure-rerun-btn");
  const statusEl = host.querySelector("#failure-rerun-status");
  if (button) {
    button.disabled = !enabled;
  }
  if (statusEl && status) {
    statusEl.textContent = status;
  }
}
