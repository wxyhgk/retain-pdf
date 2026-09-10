import type { JobLike, JobPayload } from "../../job/types.js";
import type { ProgressRecord, StageEventRecord } from "../types.js";
export declare function jobProgress(job?: JobLike | JobPayload): {
    current: number;
    total: number;
};
export declare function stageFallbackProgress(_stageKey: string, _job?: JobLike | JobPayload): any;
export interface PreferJobProgressOptions {
    currentEventRecord?: Pick<StageEventRecord, "hasCanonicalEventContract" | "isMainLane" | "canonicalDisplayStage"> | null;
}
export declare function shouldPreferJobProgress(job: JobLike | JobPayload | null | undefined, stageKey: string, latestProgress: ProgressRecord | null | undefined, { currentEventRecord, }?: PreferJobProgressOptions): boolean;
export declare function jobProgressRecord(job: JobLike | JobPayload | null | undefined, stageKey: string): ProgressRecord | null;
