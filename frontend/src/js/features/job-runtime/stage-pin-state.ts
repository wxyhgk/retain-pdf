export function currentDisplayedStagePin(state) {
  return {
    jobId: `${state?.currentJobDisplayedStageJobId || ""}`.trim(),
    stageKey: `${state?.currentJobDisplayedStageKey || ""}`.trim(),
  };
}

export function resetDisplayedStagePin(state, jobId) {
  if (!state) {
    return;
  }
  state.currentJobDisplayedStageKey = "";
  state.currentJobDisplayedStageJobId = `${jobId || ""}`.trim();
}

export function setDisplayedStagePin(state, stageKey) {
  if (!state) {
    return;
  }
  state.currentJobDisplayedStageKey = `${stageKey || ""}`.trim();
}

export function keepDisplayedStageForward({
  state,
  stageKey,
  jobId = "",
  trusted = false,
}: any) {
  const normalizedJobId = `${jobId || ""}`.trim();
  const pin = currentDisplayedStagePin(state);
  if (pin.jobId !== normalizedJobId) {
    resetDisplayedStagePin(state, normalizedJobId);
  }
  const previous = currentDisplayedStagePin(state).stageKey;
  const next = `${stageKey || ""}`.trim();
  if (next === "failed" || next === "canceled") {
    setDisplayedStagePin(state, next);
    return {
      stageKey: next,
      keptPrevious: false,
    };
  }
  if (trusted && next) {
    setDisplayedStagePin(state, next);
    return {
      stageKey: next,
      keptPrevious: false,
    };
  }
  const fallback = previous || "";
  setDisplayedStagePin(state, fallback);
  return {
    stageKey: fallback,
    keptPrevious: Boolean(fallback),
  };
}

export function pinnedStagePresentation(stageKey = "") {
  switch (stageKey) {
    case "done":
      return {
        label: "Hoàn tất",
        detail: "PDF đã dịch đã được tạo",
      };
    case "render":
      return {
        label: "Bước 3/4 · Render",
        detail: "Đang tạo PDF đã dịch",
      };
    case "translate":
      return {
        label: "Bước 2/4 · Dịch",
        detail: "Đang dịch nội dung chính",
      };
    case "ocr":
      return {
        label: "Bước 1/4 · OCR",
        detail: "Đang nhận dạng nội dung PDF",
      };
    default:
      return {
        label: "Đang chờ",
        detail: "Đang chuẩn bị",
      };
  }
}

export function resolvePinnedStagePresentation({
  state,
  jobId = "",
  presentation,
}: any) {
  const stagePresentation = { ...(presentation || {}) };
  const displayStage = keepDisplayedStageForward({
    state,
    stageKey: stagePresentation.stageKey,
    jobId,
    trusted: Boolean(stagePresentation.stageKeyTrusted),
  });
  stagePresentation.stageKey = displayStage.stageKey;
  if (!displayStage.keptPrevious) {
    return stagePresentation;
  }
  const pinned = pinnedStagePresentation(displayStage.stageKey);
  return {
    ...stagePresentation,
    visualStageKey: displayStage.stageKey,
    label: pinned.label,
    detail: pinned.detail,
    progressText: "",
    progressCurrent: null,
    progressTotal: null,
    progressIndeterminate: false,
  };
}
