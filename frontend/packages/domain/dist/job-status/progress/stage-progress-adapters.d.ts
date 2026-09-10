import type { ProgressRecord } from "../types.js";
type ProgressReplaceFn = (previous: ProgressRecord | null | undefined, next: ProgressRecord | null | undefined) => boolean;
type StageProgressRecordOptions = {
    shouldReplaceCurrentStageProgress?: ProgressReplaceFn;
    shouldReplaceStageProgress?: ProgressReplaceFn;
};
type StageProgressContext = {
    mode?: string;
    latest?: ProgressRecord | null;
    latestSameSubstage?: ProgressRecord | null;
    requestedSubstageKey?: string;
    bySubstage?: Record<string, ProgressRecord | null | undefined>;
    renderRecords?: {
        prepare?: ProgressRecord | null;
        prewarm?: ProgressRecord | null;
        pages?: ProgressRecord | null;
        compile?: ProgressRecord | null;
    };
    [key: string]: unknown;
};
export declare function stageProgressAdapterFor(stageKey?: string): {
    record(stageContext: StageProgressContext, nextProgress: ProgressRecord, options?: StageProgressRecordOptions): void;
    current(stageContext: StageProgressContext): any;
    final(stageContext: StageProgressContext): any;
};
export {};
