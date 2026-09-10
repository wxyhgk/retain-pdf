export function capRunningStagePercent(percent, stageKey = "", status = "") {
    const normalizedStageKey = `${stageKey || ""}`.trim();
    const normalizedStatus = `${status || ""}`.trim();
    if (normalizedStatus === "running"
        && ["ocr", "translate", "render"].includes(normalizedStageKey)
        && Number(percent) >= 100) {
        return 99;
    }
    return percent;
}
function cappedPercentOrNull(value, stageKey = "", status = "") {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return null;
    }
    const percent = Math.max(0, Math.min(100, numericValue));
    return capRunningStagePercent(percent, stageKey, status);
}
export function shouldAnimateRenderPageProgress({ selected, selectedIsCurrent, snapshot, selectedProgress, previous, }) {
    const targetCurrent = Number(selectedProgress?.current);
    const targetTotal = Number(selectedProgress?.total);
    const status = `${snapshot?.status || ""}`.trim();
    const canAnimateRenderPages = selected === "render"
        && selectedIsCurrent
        && status === "running"
        && selectedProgress?.progressUnit !== "percent"
        && Number.isFinite(targetCurrent)
        && Number.isFinite(targetTotal)
        && targetTotal > 0
        && targetCurrent > 0;
    const rawPreviousCurrent = Number(previous?.current);
    const previousCurrent = Number.isFinite(rawPreviousCurrent) ? rawPreviousCurrent : 0;
    const previousTotal = Number(previous?.total);
    const shouldAnimate = canAnimateRenderPages
        && (!Number.isFinite(previousTotal) || previousTotal === targetTotal)
        && targetCurrent > previousCurrent + 1;
    return {
        previousCurrent,
        shouldAnimate,
        targetCurrent,
        targetTotal,
    };
}
export function buildProgressOptions({ selected, selectedIsCurrent, snapshot, selectedProgress, displayedCurrent = null, }) {
    const presentation = buildStatusCardProgressPresentation({
        selected,
        selectedIsCurrent,
        snapshot,
        selectedProgress,
        displayedCurrent,
    });
    return {
        current: presentation.current,
        total: presentation.total,
        fallbackText: presentation.fallbackText,
        percent: presentation.percent,
        displayPercent: presentation.displayPercent,
        progressText: presentation.progressText,
        progressUnit: presentation.progressUnit,
        indeterminate: presentation.indeterminate,
        stageKey: presentation.stageKey,
        forceVisible: presentation.visible,
    };
}
export function buildStatusCardProgressPresentation({ selected, selectedIsCurrent, snapshot, selectedProgress, displayedCurrent = null, } = {}) {
    const current = displayedCurrent ?? selectedProgress?.current;
    const total = selectedProgress?.total;
    const status = `${snapshot?.status || ""}`.trim();
    const stageKey = `${selected || ""}`.trim();
    const selectedProgressUnit = `${selectedProgress?.progressUnit || ""}`.trim();
    const hasSelectedProgress = Number.isFinite(Number(current)) && Number.isFinite(Number(total)) && Number(total) > 0;
    const selectedHasUnitProgress = hasSelectedProgress && selectedProgressUnit && selectedProgressUnit !== "percent";
    const rawDerivedDisplayPercent = selected === "done" && selectedProgress?.progressUnit === "percent"
        ? Number(current)
        : null;
    const rawDisplayPercent = displayedCurrent === null
        ? selectedProgress?.displayPercent ?? (!selectedHasUnitProgress ? rawDerivedDisplayPercent : null)
        : null;
    const displayPercent = cappedPercentOrNull(rawDisplayPercent, selected, status);
    const rawPercent = displayedCurrent === null && selectedIsCurrent && selected !== "done" && !selectedHasUnitProgress
        ? snapshot?.progressPercent
        : NaN;
    const percent = cappedPercentOrNull(rawPercent, selected, status);
    const progressText = displayedCurrent === null || displayedCurrent >= Number(selectedProgress?.current)
        ? selectedProgress?.progressText || ""
        : `第 ${displayedCurrent}/${total} 页`;
    return {
        current,
        total,
        fallbackText: snapshot?.progressFallbackText,
        percent: percent ?? NaN,
        displayPercent,
        progressText,
        progressUnit: displayedCurrent === null ? selectedProgressUnit : "",
        indeterminate: displayedCurrent === null ? selectedProgress?.indeterminate : false,
        stageKey,
        status,
        visible: displayedCurrent !== null || (["ocr", "translate", "render", "done"].includes(stageKey) && hasSelectedProgress),
    };
}
