import type { JobLike } from "../../job/types.js";
import type { EventsPayload, ProgressRecord } from "../types.js";
export declare function collectLatestCurrentStageProgress(job: JobLike, eventsPayload: EventsPayload, stageKey?: string, substageKey?: string): ProgressRecord | null;
export declare function collectStageProgressByKey(job: JobLike, eventsPayload: EventsPayload): Record<string, ProgressRecord>;
