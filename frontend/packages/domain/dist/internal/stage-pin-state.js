// Vendored from frontend/web/src/js/features/job-runtime/stage-pin-state.ts — pure stage pin logic
export function currentDisplayedStagePin(state) {
    const s = state;
    return {
        jobId: `${s?.["currentJobDisplayedStageJobId"] || ""}`.trim(),
        stageKey: `${s?.["currentJobDisplayedStageKey"] || ""}`.trim(),
    };
}
export function resetDisplayedStagePin(state, jobId) {
    if (!state)
        return;
    state["currentJobDisplayedStageKey"] = "";
    state["currentJobDisplayedStageJobId"] = `${jobId || ""}`.trim();
}
export function setDisplayedStagePin(state, stageKey) {
    if (!state)
        return;
    state["currentJobDisplayedStageKey"] = `${stageKey || ""}`.trim();
}
export function keepDisplayedStageForward({ state, stageKey, jobId = "", trusted = false, }) {
    const normalizedJobId = `${jobId || ""}`.trim();
    const pin = currentDisplayedStagePin(state);
    if (pin.jobId !== normalizedJobId) {
        resetDisplayedStagePin(state, normalizedJobId);
    }
    const previous = currentDisplayedStagePin(state).stageKey;
    const next = `${stageKey || ""}`.trim();
    if (next === "failed" || next === "canceled") {
        setDisplayedStagePin(state, next);
        return { stageKey: next, keptPrevious: false };
    }
    if (trusted && next) {
        setDisplayedStagePin(state, next);
        return { stageKey: next, keptPrevious: false };
    }
    const fallback = previous || "";
    setDisplayedStagePin(state, fallback);
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
export function resolvePinnedStagePresentation({ state, jobId = "", presentation, }) {
    const stagePresentation = { ...(presentation || {}) };
    const displayStage = keepDisplayedStageForward({
        state,
        stageKey: stagePresentation["stageKey"],
        jobId,
        trusted: Boolean(stagePresentation["stageKeyTrusted"]),
    });
    stagePresentation["stageKey"] = displayStage.stageKey;
    if (!displayStage.keptPrevious)
        return stagePresentation;
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
