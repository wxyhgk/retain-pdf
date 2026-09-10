export function numberOrNull(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}
export function looksLikeProviderPercentProgress(current, total) {
    return total === 100 && current >= 0 && current <= 100;
}
export function firstNonEmpty(...values) {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return "";
}
