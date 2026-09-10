import { compareProgressEventOrder, progressUnitPriority, } from "../presentation/job-stage-presentation-utils.js";
export function shouldReplaceStageProgress(previous, next) {
    if (!previous) {
        return true;
    }
    if (previous.stageKey === "translate" && next.stageKey === "translate") {
        const order = compareProgressEventOrder(previous, next);
        if (order !== 0) {
            return order > 0;
        }
    }
    if (next.current > 0
        && next.total > 0
        && next.current >= next.total
        && (next.progressUnit === "page" || next.progressUnit === "none" || next.visualStageKey === "ocr_result_ready")) {
        return true;
    }
    const previousPriority = progressUnitPriority(previous.progressUnit);
    const nextPriority = progressUnitPriority(next.progressUnit);
    if (nextPriority !== previousPriority) {
        return nextPriority > previousPriority;
    }
    return true;
}
export function shouldReplaceCurrentStageProgress(previous, next) {
    if (!previous) {
        return true;
    }
    const previousSeq = Number(previous.seq);
    const nextSeq = Number(next.seq);
    if (Number.isFinite(previousSeq) && Number.isFinite(nextSeq) && nextSeq !== previousSeq) {
        return nextSeq > previousSeq;
    }
    const previousTs = Date.parse(previous.ts || "");
    const nextTs = Date.parse(next.ts || "");
    if (Number.isFinite(previousTs) && Number.isFinite(nextTs) && nextTs !== previousTs) {
        return nextTs > previousTs;
    }
    return true;
}
