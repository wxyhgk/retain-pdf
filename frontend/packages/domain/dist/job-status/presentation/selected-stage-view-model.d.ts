import type { ProgressRecord, StageProgressViewSnapshot } from "../types.js";
export declare function normalizeSelectedProgress(progress?: ProgressRecord | null | undefined, fallback?: ProgressRecord | null | undefined): ProgressRecord;
export declare function effectiveFlowStageKey(snapshot?: StageProgressViewSnapshot | null): string;
export declare function resolveSelectedStageContext({ snapshot, selectedStageKey, }: {
    snapshot: StageProgressViewSnapshot;
    selectedStageKey?: string;
}): {
    flowStageKey: string;
    selected: string;
    selectedHistoricalProgress: ProgressRecord;
    selectedIsCurrent: boolean;
    selectedProgress: ProgressRecord;
};
