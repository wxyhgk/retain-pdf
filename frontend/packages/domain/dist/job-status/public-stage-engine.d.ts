import type { JobLike, JobPayload } from "../job/types.js";
import type { EventsPayload, PublicStagePresentation } from "./types.js";
export type { EventsPayload, ProgressRecord, PublicStagePresentation, } from "./types.js";
export declare function publicStageKeyFromJob(job?: JobLike | JobPayload): string;
export declare function resolvePublicStagePresentation(job?: JobLike | JobPayload, eventsPayload?: EventsPayload): PublicStagePresentation;
