import type { JobDurationOptions, JobLike, JobPayload } from "./types.js";
export declare function parseIsoTime(value: any): Date;
export declare function clampPositiveMs(value: any): number;
export declare function resolveLiveDurations(job: JobLike | JobPayload | null | undefined, { finishedAtFallback, now, }?: JobDurationOptions): {
    stageElapsedText: string;
    totalElapsedText: string;
};
