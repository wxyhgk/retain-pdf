export declare function buildSelectedStageDisplay({ snapshot, selectedStageKey, }?: any): {
    flowStageKey: string;
    selected: string;
    selectedHistoricalProgress: import("./types.js").ProgressRecord;
    selectedIsCurrent: boolean;
    selectedProgress: import("./types.js").ProgressRecord;
    visualStageKey: string;
    detailText: string;
    showDetail: boolean;
    errorState: {
        errorText: string;
        isErrorStage: boolean;
        showError: boolean;
        bodyHasError: boolean;
    };
    primaryActions: {
        pdfReady: boolean;
        pdfUrl: any;
        markdownBundleReady: boolean;
        markdownBundleUrl: any;
        readerReady: boolean;
        readerUrl: any;
        sourcePdfReady: boolean;
        sourcePdfUrl: any;
    };
    retryAction: any;
};
