import type { JobLike, JobPayload } from "../../job/types.js";
import type { EventsPayload, ProgressRecord } from "../types.js";
export type ProgressReplaceFn = (previous: ProgressRecord | null | undefined, next: ProgressRecord | null | undefined) => boolean;
export interface SelectRenderProgressRecordsOptions {
    shouldReplaceCurrentStageProgress?: ProgressReplaceFn;
}
export interface RenderProgressRecords {
    refine?: ProgressRecord | null;
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
export declare function refinePhaseText(record: ProgressRecord | null | undefined): string;
/**
 * 精修排在 render_prepare 之前，而 prepare 占 0–10%。精修要调模型、耗时没法按比例估，
 * 给它百分比的话进入 prepare 时进度条会倒退，所以精修期间进度条是「不定」状态、
 * 停在 0，只靠文案说明在挑错还是在改。
 */
export declare function compositeRenderRefineProgress(record: ProgressRecord | null | undefined): {
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
