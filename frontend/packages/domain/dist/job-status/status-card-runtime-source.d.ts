import type { JobLike, JobPayload, ManifestPayload } from "../job/types.js";
import type { EventsPayload, PublicStagePresentation } from "./types.js";
/** secondaryResourceStore 单条缓存（events / manifest / stageActions） */
export interface SecondaryResourceRecordLike {
    jobId?: string;
    payload?: unknown;
    [key: string]: unknown;
}
/** secondaryResourceStore.getSnapshot() 形状；允许 host 以 Record 宽类型传入 */
export type SecondaryResourceSnapshot = Record<string, SecondaryResourceRecordLike | null | undefined> | Record<string, unknown> | null | undefined;
export interface StatusCardRuntimeLike {
    state?: unknown;
    finishedAtFallback?: (() => string) | string | null;
}
export interface StatusCardPresentationOverride {
    publicErrorText?: string;
    stagePresentation?: PublicStagePresentation | Record<string, unknown> | null;
    [key: string]: unknown;
}
export interface CurrentJobSnapshotLike {
    jobId?: string;
    snapshot?: JobLike | JobPayload | null;
    [key: string]: unknown;
}
export interface BuildRuntimeStatusCardViewModelOptions {
    runtime?: StatusCardRuntimeLike | null;
    job?: JobLike | JobPayload | null;
    jobId?: string;
    events?: EventsPayload | null | unknown;
    manifest?: ManifestPayload | null | unknown;
    stageActions?: unknown;
    publicErrorText?: string;
    stagePresentation?: PublicStagePresentation | Record<string, unknown> | null;
}
export interface BuildRuntimeStatusCardPatchPayloadOptions {
    runtime?: StatusCardRuntimeLike | null;
    job?: JobLike | JobPayload | null;
    jobId?: string;
    events?: EventsPayload | null | unknown;
    manifest?: ManifestPayload | null | unknown;
    stageActions?: unknown;
}
export interface BuildRuntimeStatusCardSnapshotOptions {
    currentJob?: CurrentJobSnapshotLike | null;
    presentationOverride?: StatusCardPresentationOverride | null;
    secondaryResources?: SecondaryResourceSnapshot;
    state?: unknown;
    finishedAtFallback?: (() => string) | string;
}
export declare function secondaryPayloadForStatusCardJob(secondarySnapshot?: SecondaryResourceSnapshot, type?: string, jobId?: string): unknown;
export declare function finishedAtFallbackForStatusCardRuntime(runtime?: StatusCardRuntimeLike | null | undefined): string;
export declare function buildRuntimeStatusCardViewModel({ runtime, job, jobId, events, manifest, stageActions, publicErrorText, stagePresentation, }?: BuildRuntimeStatusCardViewModelOptions): {
    pdfReady: boolean;
    pdfUrl: string;
    markdownBundleReady: boolean;
    markdownBundleUrl: string;
    readerReady: boolean;
    readerUrl: string;
    sourcePdfReady: boolean;
    sourcePdfUrl: string;
    cancelEnabled: boolean;
    job: any;
    jobId: any;
    status: any;
    stagePresentation: Record<string, unknown>;
    label: unknown;
    value: unknown;
    detail: string;
    stageKey: unknown;
    visualStageKey: unknown;
    elapsed: string;
    progressCurrent: unknown;
    progressTotal: unknown;
    progressFallbackText: string;
    displayPercent: unknown;
    progressPercent: any;
    progressText: unknown;
    progressUnit: unknown;
    progressIndeterminate: unknown;
    substageKey: unknown;
    backgroundStages: unknown;
    errorText: any;
    stageProgressByKey: unknown;
    stageRetryActions: {};
};
export declare function buildRuntimeStatusCardPatchPayload({ runtime, job, jobId, events, manifest, stageActions, }?: BuildRuntimeStatusCardPatchPayloadOptions): {
    job: JobLike | JobPayload;
    jobId: string;
    events: unknown;
    manifest: unknown;
    stageActions: unknown;
    publicErrorText: any;
    statusViewModel: {
        pdfReady: boolean;
        pdfUrl: string;
        markdownBundleReady: boolean;
        markdownBundleUrl: string;
        readerReady: boolean;
        readerUrl: string;
        sourcePdfReady: boolean;
        sourcePdfUrl: string;
        cancelEnabled: boolean;
        job: any;
        jobId: any;
        status: any;
        stagePresentation: Record<string, unknown>;
        label: unknown;
        value: unknown;
        detail: string;
        stageKey: unknown;
        visualStageKey: unknown;
        elapsed: string;
        progressCurrent: unknown;
        progressTotal: unknown;
        progressFallbackText: string;
        displayPercent: unknown;
        progressPercent: any;
        progressText: unknown;
        progressUnit: unknown;
        progressIndeterminate: unknown;
        substageKey: unknown;
        backgroundStages: unknown;
        errorText: any;
        stageProgressByKey: unknown;
        stageRetryActions: {};
    };
    stagePresentation: Record<string, unknown>;
};
export declare function buildRuntimeStatusCardSnapshot({ currentJob, presentationOverride, secondaryResources, state, finishedAtFallback, }?: BuildRuntimeStatusCardSnapshotOptions): {
    pdfReady: boolean;
    pdfUrl: string;
    markdownBundleReady: boolean;
    markdownBundleUrl: string;
    readerReady: boolean;
    readerUrl: string;
    sourcePdfReady: boolean;
    sourcePdfUrl: string;
    cancelEnabled: boolean;
    job: any;
    jobId: any;
    status: any;
    stagePresentation: Record<string, unknown>;
    label: unknown;
    value: unknown;
    detail: string;
    stageKey: unknown;
    visualStageKey: unknown;
    elapsed: string;
    progressCurrent: unknown;
    progressTotal: unknown;
    progressFallbackText: string;
    displayPercent: unknown;
    progressPercent: any;
    progressText: unknown;
    progressUnit: unknown;
    progressIndeterminate: unknown;
    substageKey: unknown;
    backgroundStages: unknown;
    errorText: any;
    stageProgressByKey: unknown;
    stageRetryActions: {};
};
