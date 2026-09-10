import type { JobDurationOptions, JobLike, JobPayload, StageHistoryEntry } from "./types.js";
export declare function summarizeStageName(stage: any, detail: any): string;
export declare function stageHistoryDisplay(entry?: StageHistoryEntry): {
    title: string;
    stage: string;
};
export declare function resolveStageHistoryDuration(entry: StageHistoryEntry | null | undefined, job: JobLike | JobPayload | null | undefined, { finishedAtFallback, now, }?: JobDurationOptions): number;
export declare function resolveStageHistory(job: any): any[];
