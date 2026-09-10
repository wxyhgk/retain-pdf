import type { JobLike, JobProgress } from "../../job/types.js";
import type { StructuredProgress } from "../types.js";
export declare function structuredProgressOf(payload?: JobLike): StructuredProgress;
export declare function legacyProgressOf(payload?: JobLike): StructuredProgress;
export declare function publicProgressOf(payload?: JobLike): StructuredProgress;
export declare function publicProgressUnitOf(payload?: JobLike): string;
export declare function progressWithPercent(progress?: JobProgress | StructuredProgress | Record<string, unknown>): StructuredProgress;
