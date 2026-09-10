import type { JobDurationOptions, JobLike, JobPayload } from "./types.js";
export declare function buildElapsedViewModel(snapshot: JobLike | JobPayload | null | undefined, { finishedAtFallback, now, }?: JobDurationOptions): {
    hasSnapshot: boolean;
    stageElapsedText: string;
    totalElapsedText: string;
};
