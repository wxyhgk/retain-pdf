import type { JobLike } from "../../job/types.js";
import type { ProgressRecord, StageEvent, StageEventRecord } from "../types.js";
export declare function stagePayloadFromEvent(job: JobLike, item: StageEvent, progress: {
    current?: number | null;
    total?: number | null;
    unit?: string;
    percent?: number | null;
}): JobLike;
export declare function visualStageKeyForEventPayload(payload?: JobLike, stageKey?: string): string;
export declare function normalizeProgressRecord(job: JobLike, item: StageEvent, itemStage: string, options?: Record<string, unknown>): ProgressRecord | null;
export declare function normalizeProgressRecordFromEventRecord(job?: JobLike, record?: StageEventRecord, itemStage?: string, options?: Record<string, unknown>): ProgressRecord | null;
