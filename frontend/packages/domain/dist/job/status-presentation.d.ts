export type JobStatusKey = "queued" | "running" | "succeeded" | "failed" | "canceled";
/** 颜色类别。各界面把它映射到自己的样式。 */
export type JobStatusTone = "active" | "done" | "failed" | "muted";
export type JobStatusPresentation = {
    /** 归一后的状态；没有状态时为 ""，认不出的写法原样（小写）保留。 */
    key: JobStatusKey | "" | string;
    label: string;
    tone: JobStatusTone;
};
export declare const JOB_STATUS_LABELS: Readonly<Record<JobStatusKey, string>>;
/** 折回后端的五种状态；没有状态返回 ""，认不出的返回 null。 */
export declare function normalizeJobStatus(value: unknown): JobStatusKey | "" | null;
/** 已结束：成功、失败或取消。只看状态本身，不等完成信号。 */
export declare function isFinishedJobStatus(value: unknown): boolean;
/** 排队或运行中。 */
export declare function isActiveJobStatus(value: unknown): boolean;
export type JobStatusPresentationOptions = {
    /** 没有状态（还没跑过）时的文字。 */
    idleLabel?: string;
    /** 认不出的状态显示什么；缺省原样显示。 */
    unknownLabel?: string;
    /** 只对 succeeded 生效：false 表示完成信号还没到，按运行中显示（见文件头）。 */
    succeededIsFinal?: boolean;
};
export declare function jobStatusPresentation(value: unknown, { idleLabel, unknownLabel, succeededIsFinal }?: JobStatusPresentationOptions): JobStatusPresentation;
/** 只要文字时的简写。 */
export declare function jobStatusLabel(value: unknown, options?: JobStatusPresentationOptions): string;
