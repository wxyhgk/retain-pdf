import { normalizeSubstageKey, substageProgressRange, } from "../contract/job-stage-substage-contract.js";
function clampRatio(current, total) {
    return Math.max(0, Math.min(1, current / total));
}
function validProgress(record) {
    return Boolean(record && record.current !== null && record.total !== null && record.total > 0);
}
function ocrSubstageKeyForRecord(record = {}) {
    return normalizeSubstageKey(record.substageKey || record.payload?.substage || "");
}
function compositeOcrPercent(record = null) {
    const substageKey = ocrSubstageKeyForRecord(record);
    const range = substageProgressRange(substageKey);
    if (!range) {
        return null;
    }
    const [start, end] = range.map(Number);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return null;
    }
    const ratio = validProgress(record) ? clampRatio(record.current, record.total) : 0;
    return Math.max(0, Math.min(100, start + ((end - start) * ratio)));
}
export function compositeOcrProgressFromRecord(record = null) {
    if (!record || record.stageKey !== "ocr") {
        return record;
    }
    const substageKey = ocrSubstageKeyForRecord(record);
    if (!substageKey || !substageProgressRange(substageKey)) {
        return record;
    }
    const displayPercent = compositeOcrPercent(record);
    return {
        ...record,
        displayPercent,
        substageKey,
        payload: {
            ...record.payload,
            substage: record.payload?.substage || substageKey,
        },
    };
}
