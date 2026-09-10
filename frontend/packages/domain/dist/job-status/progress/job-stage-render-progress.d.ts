import type { JobLike, JobPayload } from "../../job/types.js";
import type { EventsPayload, ProgressRecord } from "../types.js";
export type ProgressReplaceFn = (previous: ProgressRecord | null | undefined, next: ProgressRecord | null | undefined) => boolean;
export interface SelectRenderProgressRecordsOptions {
    shouldReplaceCurrentStageProgress?: ProgressReplaceFn;
}
export interface RenderProgressRecords {
    prepare?: ProgressRecord | null;
    prewarm?: ProgressRecord | null;
    pages?: ProgressRecord | null;
    compile?: ProgressRecord | null;
}
export interface CompositeRenderProgressFromEventsOptions {
    fallbackProgress?: ProgressRecord | null;
    shouldReplaceCurrentStageProgress?: ProgressReplaceFn;
}
export declare function compositeRenderCompileProgress(record: ProgressRecord | null | undefined): {
    item?: unknown;
    stageKey?: string;
    progressCurrent?: number | null;
    progressTotal?: number | null;
    progressPercent?: number | null;
    progress_unit?: string;
    sourceProgressUnit?: string;
    visualStageKey?: string;
    substageKey?: string;
    progressIndeterminate?: boolean;
    bySubstage?: Record<string, ProgressRecord | null | undefined>;
    seq?: number | null;
    ts?: string | number | null;
    current: number;
    total: number;
    progressUnit: string;
    displayPercent: number;
    progressText: string;
    payload: {
        stage_detail: string;
        progress_unit: string;
    };
    indeterminate: boolean;
};
export declare function compositeRenderPageProgress(record: ProgressRecord | null | undefined): {
    item?: unknown;
    stageKey?: string;
    progressCurrent?: number | null;
    progressTotal?: number | null;
    progressPercent?: number | null;
    progress_unit?: string;
    sourceProgressUnit?: string;
    visualStageKey?: string;
    substageKey?: string;
    progressIndeterminate?: boolean;
    bySubstage?: Record<string, ProgressRecord | null | undefined>;
    seq?: number | null;
    ts?: string | number | null;
    current: number;
    total: number;
    progressUnit: string;
    displayPercent: number;
    progressText: string;
    payload: {
        progress_unit: string;
    };
    indeterminate: boolean;
};
export declare function compositeRenderPrewarmProgress(record: ProgressRecord | null | undefined): {
    item?: unknown;
    stageKey?: string;
    progressCurrent?: number | null;
    progressTotal?: number | null;
    progressPercent?: number | null;
    progress_unit?: string;
    sourceProgressUnit?: string;
    visualStageKey?: string;
    substageKey?: string;
    progressIndeterminate?: boolean;
    bySubstage?: Record<string, ProgressRecord | null | undefined>;
    seq?: number | null;
    ts?: string | number | null;
    current: number;
    total: number;
    progressUnit: string;
    displayPercent: number;
    progressText: string;
    payload: {
        stage_detail: string;
        progress_unit: string;
    };
    indeterminate: boolean;
};
export declare function compositeRenderPrepareProgress(record: ProgressRecord | null | undefined): {
    item?: unknown;
    stageKey?: string;
    progressCurrent?: number | null;
    progressTotal?: number | null;
    progressPercent?: number | null;
    progress_unit?: string;
    sourceProgressUnit?: string;
    visualStageKey?: string;
    substageKey?: string;
    progressIndeterminate?: boolean;
    bySubstage?: Record<string, ProgressRecord | null | undefined>;
    seq?: number | null;
    ts?: string | number | null;
    current: number;
    total: number;
    progressUnit: string;
    displayPercent: number;
    progressText: string;
    payload: {
        progress_unit: string;
    };
    indeterminate: boolean;
};
export declare function compositeRenderProgressFromRecords(records?: RenderProgressRecords, fallbackProgress?: ProgressRecord | null): ProgressRecord | {
    item?: unknown;
    stageKey?: string;
    progressCurrent?: number | null;
    progressTotal?: number | null;
    progressPercent?: number | null;
    progress_unit?: string;
    sourceProgressUnit?: string;
    visualStageKey?: string;
    substageKey?: string;
    progressIndeterminate?: boolean;
    bySubstage?: Record<string, ProgressRecord | null | undefined>;
    seq?: number | null;
    ts?: string | number | null;
    current: number;
    total: number;
    progressUnit: string;
    displayPercent: number;
    progressText: string;
    payload: {
        progress_unit: string;
    };
    indeterminate: boolean;
};
export declare function compositeRenderProgressFromEvents(job: JobLike | JobPayload | null | undefined, eventsPayload: EventsPayload | null | undefined, { fallbackProgress, shouldReplaceCurrentStageProgress, }?: CompositeRenderProgressFromEventsOptions): ProgressRecord | {
    item?: unknown;
    stageKey?: string;
    progressCurrent?: number | null;
    progressTotal?: number | null;
    progressPercent?: number | null;
    progress_unit?: string;
    sourceProgressUnit?: string;
    visualStageKey?: string;
    substageKey?: string;
    progressIndeterminate?: boolean;
    bySubstage?: Record<string, ProgressRecord | null | undefined>;
    seq?: number | null;
    ts?: string | number | null;
    current: number;
    total: number;
    progressUnit: string;
    displayPercent: number;
    progressText: string;
    payload: {
        progress_unit: string;
    };
    indeterminate: boolean;
};
