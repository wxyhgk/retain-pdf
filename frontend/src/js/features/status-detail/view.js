import { $ } from "../../dom.js";

export function dialogComponent() {
  return document.querySelector("status-detail-dialog");
}

export function activateDetailTabView(name = "overview") {
  const component = dialogComponent();
  if (component?.activateTab) {
    component.activateTab(name);
    return true;
  }
  const tabs = document.querySelectorAll(".detail-tab");
  const panels = document.querySelectorAll(".detail-tab-panel");
  tabs.forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  panels.forEach((panel) => {
    const active = panel.dataset.panel === name;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
  return false;
}

export function openStatusDetailDialogView(tabName = "overview") {
  const component = dialogComponent();
  if (component?.open) {
    component.open(tabName);
    return true;
  }
  activateDetailTabView(tabName);
  $("status-detail-dialog")?.showModal();
  return false;
}

export function setRerunButtonDisabled(disabled) {
  const button = $("failure-rerun-btn");
  if (button) {
    button.disabled = disabled;
  }
}

function safeSetText(id, value) {
  const el = $(id);
  if (el) {
    el.textContent = value;
  }
}

function safeSetHtml(id, value) {
  const el = $(id);
  if (el) {
    el.innerHTML = value;
  }
}

export function renderStatusDetailHeadline(headline) {
  const component = dialogComponent();
  if (component?.setHeadline) {
    component.setHeadline(headline);
    return;
  }
  safeSetHtml("status-detail-head-icon", headline.iconMarkup);
  safeSetText("status-detail-job-id", headline.jobId);
  safeSetText("status-detail-head-note", headline.note);
}

export function renderStatusDetailRuntime(details) {
  const component = dialogComponent();
  if (component?.setRuntimeDetails && !component?.renderSnapshot) {
    component.setRuntimeDetails(details);
    return;
  }
  safeSetText("runtime-current-stage", details.currentStage);
  safeSetText("runtime-stage-elapsed", details.stageElapsed);
  safeSetText("runtime-total-elapsed", details.totalElapsed);
  safeSetText("runtime-retry-count", details.retryCount);
  safeSetText("runtime-last-transition", details.lastTransition);
  safeSetText("runtime-terminal-reason", details.terminalReason);
  safeSetText("runtime-input-protocol", details.inputProtocol);
  safeSetText("runtime-stage-spec-version", details.stageSpecVersion);
  safeSetText("runtime-math-mode", details.mathMode);
}

export function renderStatusDetailFailure(details) {
  const component = dialogComponent();
  if (component?.setFailureDetails && !component?.renderSnapshot) {
    component.setFailureDetails(details);
    return;
  }
  safeSetText("failure-summary", details.summary);
  safeSetText("failure-category", details.category);
  safeSetText("failure-stage", details.stage);
  safeSetText("failure-root-cause", details.rootCause);
  safeSetText("failure-suggestion", details.suggestion);
  safeSetText("failure-last-log-line", details.lastLogLine);
  safeSetText("failure-retryable", details.retryable);
}

export function renderStatusDetailStageHistory(stageHistory) {
  const component = dialogComponent();
  if (component?.renderStageHistory) {
    component.renderStageHistory(stageHistory);
    return;
  }
  const list = $("overview-stage-list");
  const empty = $("overview-stage-empty");
  if (!list || !empty) {
    return;
  }
  if (!stageHistory.hasItems) {
    list.innerHTML = "";
    list.classList.add("hidden");
    empty.textContent = stageHistory.emptyText;
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  list.classList.remove("hidden");
  list.innerHTML = stageHistory.markup;
}

export function renderStatusDetailEvents(events) {
  const component = dialogComponent();
  if (component?.renderEvents) {
    component.renderEvents(events);
    return;
  }
  const list = $("events-list");
  const empty = $("events-empty");
  const status = $("events-status");
  if (!list || !empty || !status) {
    return;
  }
  if (!events.hasItems) {
    status.textContent = events.emptyText;
    list.innerHTML = "";
    list.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  status.textContent = `最近 ${events.count} 条`;
  empty.classList.add("hidden");
  list.classList.remove("hidden");
  list.innerHTML = events.markup;
}

export function renderStatusDetailSnapshotSections(snapshot) {
  renderStatusDetailHeadline(snapshot.headline);
  renderStatusDetailRuntime(snapshot.runtime);
  renderStatusDetailStageHistory(snapshot.stageHistory);
  renderStatusDetailFailure(snapshot.failure);
  renderStatusDetailEvents(snapshot.events);
}

export function readTranslationFilterQuery() {
  return {
    finalStatus: `${$("translation-filter-final-status")?.value || ""}`.trim(),
    q: `${$("translation-filter-query")?.value || ""}`.trim(),
  };
}

export function bindStatusDetailEvents({
  openStatusDetailDialog,
  activateDetailTab,
  handleTranslationApply,
  changeTranslationPage,
  loadTranslationItem,
  replayCurrentItem,
  rerunCurrentJob,
  currentJobId,
  renderTranslationItemDetail,
  renderTranslationReplay,
  renderTextBlock,
}) {
  $("status-detail-btn")?.addEventListener("click", () => openStatusDetailDialog("overview"));
  document.querySelectorAll(".detail-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activateDetailTab(tab.dataset.tab || "overview");
    });
  });
  $("translation-filter-apply")?.addEventListener("click", () => {
    void handleTranslationApply();
  });
  $("translation-filter-query")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleTranslationApply();
    }
  });
  $("translation-items-prev")?.addEventListener("click", () => {
    void changeTranslationPage("prev");
  });
  $("translation-items-next")?.addEventListener("click", () => {
    void changeTranslationPage("next");
  });
  $("translation-items-list")?.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-translation-item-id]");
    const itemId = `${button?.dataset?.translationItemId || ""}`.trim();
    if (!itemId) {
      return;
    }
    void loadTranslationItem(currentJobId(), itemId).catch((error) => {
      renderTranslationItemDetail({
        emptyText: error.message || String(error),
      });
    });
  });
  $("translation-item-replay")?.addEventListener("click", () => {
    void replayCurrentItem().catch((error) => {
      renderTranslationReplay({
        hasResult: true,
        status: "重放失败",
        markup: renderTextBlock("replay_error", {
          message: error.message || String(error),
        }),
      });
    });
  });
  $("failure-rerun-btn")?.addEventListener("click", () => {
    void rerunCurrentJob();
  });
}
