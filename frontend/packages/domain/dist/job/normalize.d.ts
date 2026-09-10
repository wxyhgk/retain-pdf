import type { JobPayload, JobPayloadInput } from "./types.js";
export type { JobLike, JobPayload, JobPayloadInput, StageSnapshot } from "./types.js";
export declare function normalizeJobPayload(payload?: JobPayloadInput | unknown): JobPayload;
