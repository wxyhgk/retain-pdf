import { eventIdentity, eventLaneOf, eventPayloadOf, hasCanonicalEventContract, hasStructuredProgress, hasStructuredPublicStage, isMainLaneEvent, isPublicStageKey, normalizeDisplayStage, normalizeEventStage, normalizeUserStage, progressUnitOf, structuredPublicStageOf, } from "../contract/job-stage-event-contract.js";
export { eventIdentity, eventLaneOf, eventPayloadOf, hasCanonicalEventContract, hasStructuredProgress, hasStructuredPublicStage, isMainLaneEvent, isPublicStageKey, normalizeDisplayStage, normalizeEventStage, normalizeUserStage, progressUnitOf, structuredPublicStageOf, };
export function stageRank(stageKey) {
    return {
        queued: 0,
        ocr: 1,
        translate: 2,
        render: 3,
        done: 4,
    }[stageKey] ?? 0;
}
export function numberOrNull(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}
export function firstNumber(...values) {
    for (const value of values) {
        const num = numberOrNull(value);
        if (num !== null) {
            return num;
        }
    }
    return null;
}
export function progressUnitPriority(unit = "") {
    switch (`${unit || ""}`.trim()) {
        case "page":
        case "batch":
            return 3;
        case "percent":
            return 2;
        case "step":
            return 1;
        default:
            return 0;
    }
}
export function publicStageOf(payload = {}) {
    const structuredPublicStage = structuredPublicStageOf(payload);
    if (structuredPublicStage) {
        return structuredPublicStage;
    }
    const snapshotPublicStage = normalizeDisplayStage(payload.stage_snapshot?.publicStage);
    if (isPublicStageKey(snapshotPublicStage)) {
        return snapshotPublicStage;
    }
    if (hasCanonicalEventContract(payload)) {
        return "";
    }
    return "";
}
export function canonicalStageOf(payload = {}) {
    const publicStage = publicStageOf(payload);
    if (publicStage) {
        return publicStage;
    }
    return "";
}
export function compareProgressEventOrder(previous, next) {
    if (!previous) {
        return 1;
    }
    const previousSeq = Number(previous.seq);
    const nextSeq = Number(next.seq);
    if (Number.isFinite(previousSeq) && Number.isFinite(nextSeq) && nextSeq !== previousSeq) {
        return nextSeq > previousSeq ? 1 : -1;
    }
    const previousTs = Date.parse(previous.ts || "");
    const nextTs = Date.parse(next.ts || "");
    if (Number.isFinite(previousTs) && Number.isFinite(nextTs) && nextTs !== previousTs) {
        return nextTs > previousTs ? 1 : -1;
    }
    return 1;
}
