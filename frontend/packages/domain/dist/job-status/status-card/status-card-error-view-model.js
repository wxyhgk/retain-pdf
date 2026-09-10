export function buildStatusCardErrorState(snapshot = null) {
    const stageKey = `${snapshot?.stageKey || ""}`.trim();
    const errorText = `${snapshot?.errorText || ""}`.trim();
    const isErrorStage = stageKey === "failed" || stageKey === "canceled";
    const showError = Boolean(isErrorStage && errorText);
    return {
        errorText,
        isErrorStage,
        showError,
        bodyHasError: showError,
    };
}
