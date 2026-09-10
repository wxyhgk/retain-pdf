import { eventIdentity, eventLaneOf, eventPayloadOf, hasCanonicalEventContract, hasStructuredProgress, hasStructuredPublicStage, isMainLaneEvent, isPublicStageKey, normalizeDisplayStage, normalizeEventStage, normalizeUserStage, progressUnitOf, structuredPublicStageOf } from "../contract/job-stage-event-contract.js";
export { eventIdentity, eventLaneOf, eventPayloadOf, hasCanonicalEventContract, hasStructuredProgress, hasStructuredPublicStage, isMainLaneEvent, isPublicStageKey, normalizeDisplayStage, normalizeEventStage, normalizeUserStage, progressUnitOf, structuredPublicStageOf, };
export declare function stageRank(stageKey: any): any;
export declare function numberOrNull(value: any): number;
export declare function firstNumber(...values: any[]): number;
export declare function progressUnitPriority(unit?: string): 0 | 1 | 2 | 3;
export declare function publicStageOf(payload?: any): string;
export declare function canonicalStageOf(payload?: any): string;
export declare function compareProgressEventOrder(previous: any, next: any): -1 | 1;
