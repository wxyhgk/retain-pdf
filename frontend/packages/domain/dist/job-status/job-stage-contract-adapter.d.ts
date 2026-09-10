import type { JobLike } from "../job/types.js";
import type { AdaptedStageSnapshot, StageEvent } from "./types.js";
export type { AdaptedStageSnapshot, StageEvent } from "./types.js";
export declare function adaptJobStageSnapshot(payload?: JobLike): AdaptedStageSnapshot;
export declare function adaptJobEventStageSnapshot(event?: StageEvent): AdaptedStageSnapshot;
