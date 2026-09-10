export declare const READER_PROGRESS_COPY: Readonly<{
    boot: "正在准备对照阅读…";
    metadata: "正在读取任务信息…";
    both: "正在加载原始 PDF 和译文 PDF…";
    sourceOnly: "原始 PDF 已加载，正在加载译文 PDF…";
    translatedOnly: "译文 PDF 已加载，正在加载原始 PDF…";
    ready: "对照阅读已就绪";
    failed: "对照阅读加载失败";
}>;
export declare function createReaderPageState(): {
    reader: {
        totalPages: number;
        currentPage: number;
        primaryViewerKey: string;
    };
    progress: {
        metadataReady: boolean;
        sourceDone: boolean;
        translatedDone: boolean;
    };
    bootProgressBar: {
        value: number;
        target: number;
        rafId: number;
    };
};
export declare function resetReaderProgressState(state: any): void;
export declare function computeReaderProgressSnapshot(progressState: any, copy?: any): {
    percent: number;
    text: any;
    stage: string;
};
//# sourceMappingURL=page-state.d.ts.map