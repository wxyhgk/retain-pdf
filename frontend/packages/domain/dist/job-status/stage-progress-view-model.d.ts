import type { ProgressRecord, StageProgressViewSnapshot } from "./types.js";
export type NormalizeSelectedProgressFn = (progress?: ProgressRecord | null, fallback?: ProgressRecord | null) => ProgressRecord;
export declare function currentStageProgressViewModel(snapshot?: StageProgressViewSnapshot, { normalizeSelectedProgress }?: {
    normalizeSelectedProgress?: NormalizeSelectedProgressFn;
}): ProgressRecord;
