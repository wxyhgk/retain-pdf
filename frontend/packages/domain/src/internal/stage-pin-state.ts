// Vendored from frontend/web/src/js/features/job-runtime/stage-pin-state.ts — pure stage pin logic
export function currentDisplayedStagePin(state: unknown) {
  const s = state as Record<string, unknown> | null | undefined;
  return {
    jobId: `${(s?.["currentJobDisplayedStageJobId"] as string) || ""}`.trim(),
    stageKey: `${(s?.["currentJobDisplayedStageKey"] as string) || ""}`.trim(),
  };
}

export function resetDisplayedStagePin(state: Record<string, unknown> | null | undefined, jobId: unknown) {
  if (!state) return;
  state["currentJobDisplayedStageKey"] = "";
  state["currentJobDisplayedStageJobId"] = `${(jobId as string) || ""}`.trim();
}

export function setDisplayedStagePin(state: Record<string, unknown> | null | undefined, stageKey: unknown) {
  if (!state) return;
  state["currentJobDisplayedStageKey"] = `${(stageKey as string) || ""}`.trim();
}

export function keepDisplayedStageForward({
  state,
  stageKey,
  jobId = "",
  trusted = false,
}: { state: unknown; stageKey: unknown; jobId?: unknown; trusted?: boolean }) {
  const normalizedJobId = `${(jobId as string) || ""}`.trim();
  const pin = currentDisplayedStagePin(state);
  if (pin.jobId !== normalizedJobId) {
    resetDisplayedStagePin(state as Record<string, unknown>, normalizedJobId);
  }
  const previous = currentDisplayedStagePin(state).stageKey;
  const next = `${(stageKey as string) || ""}`.trim();
  if (next === "failed" || next === "canceled") {
    setDisplayedStagePin(state as Record<string, unknown>, next);
    return { stageKey: next, keptPrevious: false };
  }
  if (trusted && next) {
    setDisplayedStagePin(state as Record<string, unknown>, next);
    return { stageKey: next, keptPrevious: false };
  }
  const fallback = previous || "";
  setDisplayedStagePin(state as Record<string, unknown>, fallback);
  return { stageKey: fallback, keptPrevious: Boolean(fallback) };
}

export function pinnedStagePresentation(stageKey = "") {
  switch (stageKey) {
    case "done":
      return { label: "完成", detail: "翻译 PDF 已生成" };
    case "render":
      return { label: "第 3/4 步 · 渲染", detail: "正在生成翻译后的 PDF" };
    case "translate":
      return { label: "第 2/4 步 · 翻译", detail: "正在翻译正文内容" };
    case "ocr":
      return { label: "第 1/4 步 · OCR 解析", detail: "正在识别 PDF 内容" };
    default:
      return { label: "等待中", detail: "准备中" };
  }
}

export function resolvePinnedStagePresentation({
  state,
  jobId = "",
  presentation,
}: { state: unknown; jobId?: unknown; presentation: unknown }) {
  const stagePresentation = { ...(presentation as Record<string, unknown> || {}) } as Record<string, unknown>;
  const displayStage = keepDisplayedStageForward({
    state,
    stageKey: stagePresentation["stageKey"],
    jobId,
    trusted: Boolean(stagePresentation["stageKeyTrusted"]),
  });
  stagePresentation["stageKey"] = displayStage.stageKey;
  if (!displayStage.keptPrevious) return stagePresentation;
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
