/** 状态卡 snapshot 中与进度展示相关的字段 */
export interface StatusCardProgressSnapshot {
    status?: string;
    progressPercent?: number | null;
    progressFallbackText?: string;
    [key: string]: unknown;
}
/** selectedProgress / previous 进度分片（stageProgressByKey 项） */
export interface StatusCardSelectedProgress {
    current?: number | null;
    total?: number | null;
    progressUnit?: string;
    displayPercent?: number | null;
    progressText?: string;
    indeterminate?: boolean;
    [key: string]: unknown;
}
export interface ShouldAnimateRenderPageProgressOptions {
    selected?: string;
    selectedIsCurrent?: boolean;
    snapshot?: StatusCardProgressSnapshot | null;
    selectedProgress?: StatusCardSelectedProgress | null;
    previous?: Pick<StatusCardSelectedProgress, "current" | "total"> | null;
}
export interface BuildStatusCardProgressPresentationOptions {
    selected?: string;
    selectedIsCurrent?: boolean;
    snapshot?: StatusCardProgressSnapshot | null;
    selectedProgress?: StatusCardSelectedProgress | null;
    displayedCurrent?: number | null;
}
export declare function capRunningStagePercent(percent: number, stageKey?: string, status?: string): number;
export declare function shouldAnimateRenderPageProgress({ selected, selectedIsCurrent, snapshot, selectedProgress, previous, }: ShouldAnimateRenderPageProgressOptions): {
    previousCurrent: number;
    shouldAnimate: boolean;
    targetCurrent: number;
    targetTotal: number;
};
export declare function buildProgressOptions({ selected, selectedIsCurrent, snapshot, selectedProgress, displayedCurrent, }: BuildStatusCardProgressPresentationOptions): {
    current: number;
    total: number;
    fallbackText: string;
    percent: number;
    displayPercent: number;
    progressText: string;
    progressUnit: string;
    indeterminate: boolean;
    stageKey: string;
    forceVisible: boolean;
};
export declare function buildStatusCardProgressPresentation({ selected, selectedIsCurrent, snapshot, selectedProgress, displayedCurrent, }?: BuildStatusCardProgressPresentationOptions): {
    current: number;
    total: number;
    fallbackText: string;
    percent: number;
    displayPercent: number;
    progressText: string;
    progressUnit: string;
    indeterminate: boolean;
    stageKey: string;
    status: string;
    visible: boolean;
};
