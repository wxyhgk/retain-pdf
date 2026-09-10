import { resolveLiveDurations } from "./durations.js";
export function buildElapsedViewModel(snapshot, { finishedAtFallback = "", now = null, } = {}) {
    if (!snapshot) {
        return {
            hasSnapshot: false,
            stageElapsedText: "-",
            totalElapsedText: "-",
        };
    }
    const durations = resolveLiveDurations(snapshot, {
        finishedAtFallback,
        now,
    });
    return {
        hasSnapshot: true,
        stageElapsedText: durations.stageElapsedText,
        totalElapsedText: durations.totalElapsedText,
    };
}
