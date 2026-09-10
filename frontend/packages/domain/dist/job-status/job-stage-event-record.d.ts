import type { JobLike } from "../job/types.js";
import type { StageEvent, StageEventRecord } from "./types.js";
export declare function normalizedStageEventRecord(item?: StageEvent): StageEventRecord;
export declare function eventStageForMatch(item?: StageEvent): string;
export declare function eventStageForMatchRecord(record?: Partial<StageEventRecord>): string;
export declare function structuredStagePayloadFromEventRecord(job?: JobLike, record?: Partial<StageEventRecord>): JobLike;
export declare function stagePayloadFromEventRecord(job?: JobLike, record?: Partial<StageEventRecord>): JobLike;
