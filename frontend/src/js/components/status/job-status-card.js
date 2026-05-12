import {
  DOWNLOAD_ANIMATION_PATH,
  OCR_ANIMATION_PATH,
  RENDER_ANIMATION_PATH,
  STAGE_ANIMATIONS,
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
import { resolveSelectedStage, syncStageFlow } from "./job-status-card-stage-flow.js";
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

  setStageFlow(stageKey = "", selectedStageKey = "") {
    syncStageFlow(this, stageKey, selectedStageKey);
  }

  syncPrimaryActions({ pdfReady = false, readerReady = false } = {}) {
    syncPrimaryActions(this, { pdfReady, readerReady });
  }

  #syncTranslationSubstages(selectedStageKey, selectedIsCurrent) {
    syncTranslationSubstageStates(this.querySelector(".status-substage-flow"), selectedStageKey, selectedIsCurrent, this.#lastSnapshot);
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
    visualStageKey = "",
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
      visualStageKey,
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
    const selected = this.#selectedStageKey || snapshot.stageKey;
    const selectedIsCurrent = selected === snapshot.stageKey || !selected;
    this.setStageFlow(snapshot.stageKey, selected);
    this.#syncTranslationSubstages(selected, selectedIsCurrent);
    this.#stageAnimationController?.setStageVisualMode(resolveVisualStageKeyForSnapshot(snapshot, selected));
    const labelEl = this.querySelector("#status-ring-label");
    if (labelEl && !selectedIsCurrent) {
      labelEl.textContent = `${STAGE_LABELS[selected] || "阶段"} 阶段`;
    } else if (labelEl) {
      labelEl.textContent = snapshot.label;
    }
    this.setProgress({
      current: snapshot.progressCurrent,
      total: snapshot.progressTotal,
      fallbackText: snapshot.progressFallbackText,
      percent: snapshot.progressPercent,
      progressText: snapshot.progressText,
      stageKey: snapshot.stageKey,
      forceVisible: selectedIsCurrent && ["ocr", "translate", "render"].includes(snapshot.stageKey),
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
