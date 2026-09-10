import type { JobLike, JobPayload } from "../../job/types.js";
import type { EventsPayload, JobDisplayState } from "../types.js";
export type { BackgroundStageEntry, EventsPayload, JobDisplayState, } from "../types.js";
export declare function resolveJobDisplayState(job?: JobLike | JobPayload, eventsPayload?: EventsPayload | null): JobDisplayState;
export declare function buildJobPatchWithDisplayState(job?: JobLike | JobPayload, eventsPayload?: EventsPayload | null): JobLike;
