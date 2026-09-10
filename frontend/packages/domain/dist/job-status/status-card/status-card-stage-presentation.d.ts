import type { JobLike, JobPayload } from "../../job/types.js";
import type { EventsPayload, PublicStagePresentation } from "../types.js";
export interface ResolveSafeStatusCardStagePresentationOptions {
    state?: unknown;
    job?: JobLike | JobPayload | null;
    jobId?: string;
    events?: EventsPayload | null;
    stagePresentation?: Partial<PublicStagePresentation> | Record<string, unknown> | null;
}
export declare function resolveSafeStatusCardStagePresentation({ state, job, jobId, events, stagePresentation, }?: ResolveSafeStatusCardStagePresentationOptions): Record<string, unknown>;
