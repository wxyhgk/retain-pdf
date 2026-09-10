export declare function resolveRenderStagePresentation({ state, job, jobId, events, }: any): {
    stageProgressByKey: Record<string, import("../types.js").ProgressRecord>;
    backgroundStages: import("./job-display-state.js").BackgroundStageEntry[];
};
