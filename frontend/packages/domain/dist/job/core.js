export function numberOrNull(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}
export function arrayOrEmpty(value) {
    return Array.isArray(value) ? value : [];
}
export function objectOrNull(value) {
    return value && typeof value === "object" ? value : null;
}
export function unwrapEnvelope(payload) {
    if (payload && typeof payload === "object" && "data" in payload && "code" in payload) {
        const envelope = payload;
        if (envelope.code !== 0) {
            throw new Error(envelope.message || `API returned code ${envelope.code}`);
        }
        return (envelope.data ?? null);
    }
    return payload;
}
export function firstNonEmpty(...values) {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return "";
}
export function firstDefined(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null) {
            return value;
        }
    }
    return undefined;
}
export function isTerminalStatus(status) {
    return status === "succeeded" || status === "failed" || status === "canceled";
}
function activeStageSignal(payload = {}) {
    const text = firstNonEmpty(payload?.display_stage, payload?.stage_snapshot?.publicStage, payload?.stage_snapshot?.stageKey).toLowerCase();
    if (!text) {
        return "";
    }
    if (text === "translation" || text === "translate" || text.includes("translat")) {
        return "translation";
    }
    if (text === "ocr" || text.includes("ocr") || text.includes("paddle") || text.includes("mineru") || text.includes("normaliz")) {
        return "ocr";
    }
    if (text === "render" || text.includes("render") || text.includes("compile") || text.includes("overlay") || text.includes("saving")) {
        return "render";
    }
    if (text === "done") {
        return "done";
    }
    return "";
}
function hasFinalArtifactSignal(payload = {}) {
    if (!payload || typeof payload !== "object") {
        return false;
    }
    const artifacts = (payload.artifacts || {});
    const artifactFlags = [
        payload.output_pdf_ready,
        payload.pdf_ready,
        payload.translated_pdf_ready,
        artifacts.output_pdf_ready,
        artifacts.pdf_ready,
        artifacts.translated_pdf_ready,
    ];
    if (artifactFlags.some((value) => value === true)) {
        return true;
    }
    const displayArtifacts = Array.isArray(payload.artifacts_display) ? payload.artifacts_display : [];
    return displayArtifacts.some((artifact) => {
        const key = `${artifact?.key || artifact?.kind || ""}`.trim().toLowerCase();
        return artifact?.ready === true && (key === "pdf" || key === "translated_pdf" || key === "output_pdf");
    });
}
function hasExplicitDoneSignal(payload = {}) {
    const stageSignal = activeStageSignal(payload);
    if (stageSignal) {
        return stageSignal === "done";
    }
    const runtime = (payload?.runtime || {});
    const terminalReason = firstNonEmpty(payload?.terminal_reason, runtime.terminal_reason).toLowerCase();
    if (terminalReason === "completed" || terminalReason === "done") {
        return true;
    }
    return hasFinalArtifactSignal(payload);
}
export function isJobTerminal(payload = {}) {
    const status = typeof payload === "string" ? payload : payload?.status;
    if (status === "failed" || status === "canceled") {
        return true;
    }
    if (status !== "succeeded") {
        return false;
    }
    if (typeof payload === "string" || !payload || typeof payload !== "object") {
        return true;
    }
    return hasExplicitDoneSignal(payload);
}
