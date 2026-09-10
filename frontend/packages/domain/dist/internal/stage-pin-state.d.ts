export declare function currentDisplayedStagePin(state: unknown): {
    jobId: string;
    stageKey: string;
};
export declare function resetDisplayedStagePin(state: Record<string, unknown> | null | undefined, jobId: unknown): void;
export declare function setDisplayedStagePin(state: Record<string, unknown> | null | undefined, stageKey: unknown): void;
export declare function keepDisplayedStageForward({ state, stageKey, jobId, trusted, }: {
    state: unknown;
    stageKey: unknown;
    jobId?: unknown;
    trusted?: boolean;
}): {
    stageKey: string;
    keptPrevious: boolean;
};
export declare function pinnedStagePresentation(stageKey?: string): {
    label: string;
    detail: string;
};
export declare function resolvePinnedStagePresentation({ state, jobId, presentation, }: {
    state: unknown;
    jobId?: unknown;
    presentation: unknown;
}): Record<string, unknown>;
