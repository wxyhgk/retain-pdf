import {
  DOWNLOAD_ANIMATION_PATH,
  OCR_ANIMATION_PATH,
  RENDER_ANIMATION_PATH,
  STAGE_ANIMATIONS,
  STAGE_FLOW,
  STAGE_LABELS,
  TRANSLATION_ANIMATION_PATH,
  UPLOAD_ANIMATION_PATH,
} from "./job-status-card-presets.js";
import {
  resolveVisualStageKeyForSnapshot,
} from "./job-status-card-visuals.js";
import { createStatusStageAnimationController } from "./job-status-card-animation.js";
import {
  setBackHomeVisible,
  setCancelEnabled,
  setElapsed,
  setProgress,
  syncPrimaryActions,
} from "./job-status-card-rendering.js";
import {
  resolveSelectedStage,
  syncStageFlow,
} from "./job-status-card-stage-flow.js";
import { syncTranslationSubstageStates } from "./job-status-card-substages.js";
import { jobStatusCardTemplate } from "./job-status-card-template.js";

class JobStatusCard extends HTMLElement {
  #stageAnimationController = null;
  #currentStageKey = "";
  #selectedStageKey = "";
  #manualStageSelection = false;
  #lastSnapshot = null;

  connectedCallback() {
    if (this.dataset.hydrated === "1") {
      return;
    }
    this.dataset.hydrated = "1";
    this.id = this.id || "status-section";
    this.classList.add("card", "status-card", "hidden");
    this.#stageAnimationController = createStatusStageAnimationController(this);
    this.innerHTML = jobStatusCardTemplate({
      translationAnimationPath: TRANSLATION_ANIMATION_PATH,
      ocrAnimationPath: OCR_ANIMATION_PATH,
      uploadAnimationPath: UPLOAD_ANIMATION_PATH,
      downloadAnimationPath: DOWNLOAD_ANIMATION_PATH,
      renderAnimationPath: RENDER_ANIMATION_PATH,
    });
    this.querySelector("#status-stage-flow")?.addEventListener("click", (event) => {
      const button = event.target?.closest?.(".status-stage-step");
      const stageKey = button?.dataset?.stageKey || "";
      if (!stageKey || button.disabled) {
        return;
      }
      this.#manualStageSelection = true;
      this.#selectedStageKey = stageKey;
      this.#renderSelectedStage();
    });
  }

  setStagePresentation({ label = "等待中", value = "准备中", stageKey = "" } = {}) {
    const labelEl = this.querySelector("#status-ring-label");
    const valueEl = this.querySelector("#status-ring-value");
    const detailEl = this.querySelector("#status-stage-detail");
    const previousCurrentStageKey = this.#currentStageKey;
    this.#currentStageKey = `${stageKey || ""}`.trim();
    if (previousCurrentStageKey && previousCurrentStageKey !== this.#currentStageKey) {
      this.#manualStageSelection = false;
    }
    const selection = resolveSelectedStage({
      currentStageKey: this.#currentStageKey,
      selectedStageKey: this.#selectedStageKey,
      manualStageSelection: this.#manualStageSelection,
    });
    this.#selectedStageKey = selection.selectedStageKey;
    this.#manualStageSelection = selection.manualStageSelection;
    this.setStageFlow(this.#currentStageKey, this.#selectedStageKey);
    const selectedIsCurrent = !this.#selectedStageKey || this.#selectedStageKey === this.#currentStageKey;
    const visualStageKey = selectedIsCurrent ? resolveVisualStageKeyForSnapshot(this.#lastSnapshot, this.#currentStageKey) : this.#selectedStageKey;
    this.#stageAnimationController?.setStageVisualMode(visualStageKey);
    if (labelEl) {
      labelEl.textContent = selectedIsCurrent ? label : `${STAGE_LABELS[this.#selectedStageKey] || "阶段"} 阶段`;
    }
    if (valueEl) {
      valueEl.textContent = value;
    }
    if (detailEl) {
      detailEl.textContent = value;
    }
  }

  #effectiveFlowStageKey(snapshot = this.#lastSnapshot) {
    const stageKey = `${snapshot?.stageKey || ""}`.trim();
    if (STAGE_FLOW.includes(stageKey)) {
      return stageKey;
    }
    const progressByKey = snapshot?.stageProgressByKey || {};
    return [...STAGE_FLOW].reverse().find((key) => progressByKey[key]) || "";
  }

  setStageFlow(stageKey = "", selectedStageKey = "") {
    syncStageFlow(this, stageKey, selectedStageKey);
  }

  syncPrimaryActions({ pdfReady = false, readerReady = false } = {}) {
    syncPrimaryActions(this, { pdfReady, readerReady });
  }

  #syncTranslationSubstages(selectedStageKey, selectedIsCurrent, selectedProgress = null) {
    syncTranslationSubstageStates(
      this.querySelector(".status-substage-flow"),
      selectedStageKey,
      selectedIsCurrent,
      this.#lastSnapshot,
      selectedProgress,
    );
  }

  #normalizeSelectedProgress(progress = {}, fallback = {}) {
    const current = Number(progress?.current ?? progress?.progressCurrent ?? fallback?.current ?? fallback?.progressCurrent);
    const total = Number(progress?.total ?? progress?.progressTotal ?? fallback?.total ?? fallback?.progressTotal);
    return {
      current: Number.isFinite(current) ? current : NaN,
      total: Number.isFinite(total) ? total : NaN,
      progressText: progress?.progressText || fallback?.progressText || "",
      indeterminate: Boolean(progress?.indeterminate ?? progress?.progressIndeterminate ?? fallback?.indeterminate ?? fallback?.progressIndeterminate),
      substageKey: progress?.substageKey || fallback?.substageKey || "",
      visualStageKey: progress?.visualStageKey || fallback?.visualStageKey || "",
    };
  }

  setElapsed(value = "-") {
    setElapsed(this, value);
  }

  setProgress(options = {}) {
    setProgress(this, options);
  }

  setCancelEnabled(enabled) {
    setCancelEnabled(this, enabled);
  }

  setBackHomeVisible(visible) {
    setBackHomeVisible(this, visible);
  }

  renderSnapshot({
    label = "等待中",
    value = "准备中",
    stageKey = "",
    elapsed = "-",
    progressCurrent = NaN,
    progressTotal = NaN,
    progressFallbackText = "-",
    progressPercent = NaN,
    progressText = "",
    progressIndeterminate = false,
    substageKey = "",
    errorText = "",
    visualStageKey = "",
    stageProgressByKey = {},
    pdfReady = false,
    readerReady = false,
    cancelEnabled = false,
    backHomeVisible = false,
  } = {}) {
    this.#lastSnapshot = {
      label,
      value,
      stageKey,
      elapsed,
      progressCurrent,
      progressTotal,
      progressFallbackText,
      progressPercent,
      progressText,
      progressIndeterminate,
      substageKey,
      errorText,
      visualStageKey,
      stageProgressByKey,
      pdfReady,
      readerReady,
      cancelEnabled,
      backHomeVisible,
    };
    this.setStagePresentation({ label, value, stageKey });
    this.setElapsed(elapsed);
    this.#renderSelectedStage();
    this.setCancelEnabled(cancelEnabled);
    this.setBackHomeVisible(backHomeVisible);
  }

  #renderSelectedStage() {
    const snapshot = this.#lastSnapshot;
    if (!snapshot) {
      return;
    }
    const flowStageKey = this.#effectiveFlowStageKey(snapshot);
    const selected = this.#selectedStageKey || flowStageKey || snapshot.stageKey;
    const selectedIsCurrent = selected === snapshot.stageKey;
    this.setStageFlow(flowStageKey || snapshot.stageKey, selected);
    const selectedHistoricalProgress = selectedIsCurrent ? null : snapshot.stageProgressByKey?.[selected];
    this.#stageAnimationController?.setStageVisualMode(
      selectedHistoricalProgress?.visualStageKey || resolveVisualStageKeyForSnapshot(snapshot, selected),
    );
    const errorSummaryEl = this.querySelector("#status-stage-error-summary");
    const errorText = `${snapshot.errorText || ""}`.trim();
    const selectedIsError = snapshot.stageKey === "failed" || snapshot.stageKey === "canceled";
    const currentProgress = {
      current: snapshot.progressCurrent,
      total: snapshot.progressTotal,
      progressText: snapshot.progressText,
      indeterminate: snapshot.progressIndeterminate,
      substageKey: snapshot.substageKey,
      visualStageKey: snapshot.visualStageKey,
    };
    const selectedProgress = selectedIsCurrent
      ? this.#normalizeSelectedProgress(currentProgress, snapshot.stageProgressByKey?.[selected])
      : this.#normalizeSelectedProgress(selectedHistoricalProgress);
    this.#syncTranslationSubstages(selected, selectedIsCurrent, selectedProgress);
    this.#stageAnimationController?.syncProgressSpeed({
      stageKey: selected,
      current: selectedProgress?.current,
      total: selectedProgress?.total,
    });
    if (errorSummaryEl) {
      errorSummaryEl.textContent = errorText;
      errorSummaryEl.classList.toggle("hidden", !selectedIsError || !errorText);
    }
    this.setProgress({
      current: selectedProgress?.current,
      total: selectedProgress?.total,
      fallbackText: snapshot.progressFallbackText,
      percent: selectedIsCurrent ? snapshot.progressPercent : NaN,
      progressText: selectedProgress?.progressText || "",
      indeterminate: selectedProgress?.indeterminate,
      stageKey: selected,
      forceVisible: ["ocr", "translate", "render"].includes(selected)
        && (selectedIsCurrent || Boolean(selectedProgress)),
    });
    this.syncPrimaryActions({
      pdfReady: selected === "done" && snapshot.pdfReady,
      readerReady: selected === "done" && snapshot.readerReady,
    });
  }
}

if (!customElements.get("job-status-card")) {
  customElements.define("job-status-card", JobStatusCard);
}
