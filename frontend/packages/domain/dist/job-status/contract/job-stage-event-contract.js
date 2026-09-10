const PUBLIC_STAGE_KEYS = new Set(["ocr", "translate", "render", "done"]);
export function eventPayloadOf(event = {}) {
    return event?.payload && typeof event.payload === "object" ? event.payload : {};
}
export function normalizeEventStage(value = "") {
    const stage = `${value || ""}`.trim().toLowerCase();
    if (stage === "translation") {
        return "translate";
    }
    return stage;
}
export function normalizeUserStage(value = "") {
    return normalizeEventStage(value);
}
export function normalizeDisplayStage(value = "") {
    const stage = normalizeEventStage(value);
    return stage === "translating" ? "translate" : stage;
}
export function isPublicStageKey(value = "") {
    return PUBLIC_STAGE_KEYS.has(normalizeEventStage(value));
}
export function hasStructuredProgress(event = {}) {
    const payload = eventPayloadOf(event);
    return Boolean(event?.progress && typeof event.progress === "object")
        || Boolean(payload?.progress && typeof payload.progress === "object");
}
export function eventIdentity(event = {}) {
    const seq = Number(event.seq);
    const ts = Date.parse(event.ts || event.created_at || "");
    return {
        seq: Number.isFinite(seq) ? seq : null,
        ts: Number.isFinite(ts) ? ts : null,
    };
}
export function eventLaneOf(event = {}) {
    const payload = eventPayloadOf(event);
    return `${event?.lane || payload.lane || ""}`.trim().toLowerCase();
}
export function isMainLaneEvent(event = {}) {
    const lane = eventLaneOf(event);
    return !lane || lane === "main";
}
export function structuredPublicStageOf(event = {}) {
    const payload = eventPayloadOf(event);
    const explicitCandidates = [event.display_stage, payload.display_stage];
    for (const candidate of explicitCandidates) {
        const normalized = normalizeDisplayStage(candidate);
        if (PUBLIC_STAGE_KEYS.has(normalized)) {
            return normalized;
        }
    }
    return "";
}
export function hasStructuredPublicStage(event = {}) {
    const payload = eventPayloadOf(event);
    return Boolean(`${event.display_stage || payload.display_stage || ""}`.trim());
}
export function hasCanonicalEventContract(event = {}) {
    const payload = eventPayloadOf(event);
    return hasStructuredPublicStage(event)
        || Boolean(`${event.lane || payload.lane || ""}`.trim());
}
export function progressUnitOf(event = {}) {
    const progress = (event?.progress && typeof event.progress === "object" ? event.progress : {});
    if (`${progress.unit || ""}`.trim()) {
        return `${progress.unit}`.trim().toLowerCase();
    }
    const payload = eventPayloadOf(event);
    const payloadProgress = (payload?.progress && typeof payload.progress === "object" ? payload.progress : {});
    if (`${payloadProgress.unit || ""}`.trim()) {
        return `${payloadProgress.unit}`.trim().toLowerCase();
    }
    if (hasStructuredProgress(event) || hasCanonicalEventContract(event)) {
        return "";
    }
    return `${event?.progress_unit || payload.progress_unit || ""}`.trim().toLowerCase();
}
