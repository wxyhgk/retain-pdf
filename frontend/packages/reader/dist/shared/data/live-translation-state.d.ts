import type { LiveTranslationCommitEvent, LiveTranslationItem, LiveTranslationLayout, LiveTranslationLayoutPage, LiveTranslationPageSnapshot } from "@retainpdf/api/live-translation";
export type LiveTranslationPageState = {
    attempt: number;
    generation: number;
    pageHash: string;
    itemsById: ReadonlyMap<string, LiveTranslationItem>;
    /** Last authoritative SSE seq that changed this item; used only as an animation key. */
    changedAtSeqById: ReadonlyMap<string, number>;
    lastEventSeq: number;
};
export type LiveTranslationState = {
    layoutByPage: ReadonlyMap<number, LiveTranslationLayoutPage>;
    pagesByPage: ReadonlyMap<number, LiveTranslationPageState>;
    lastSeq: number;
    connection: "idle" | "connecting" | "live" | "reconnecting" | "terminal" | "unavailable";
    /** Authoritative task status supplied by the Reader session. */
    jobStatus: string;
    /** Human-readable transport/capability failure. Never contains translated content. */
    error: string;
};
export declare const EMPTY_LIVE_TRANSLATION_STATE: LiveTranslationState;
export declare function layoutPageMap(layout: LiveTranslationLayout): ReadonlyMap<number, LiveTranslationLayoutPage>;
export type SnapshotDecision = "accept" | "ignore" | "retry";
/**
 * Decide against the event first, then against the already rendered page.
 * A newer snapshot is valid because the immutable page endpoint may have advanced
 * again between the SSE hint and this read.
 */
export declare function decideLiveTranslationSnapshot(current: LiveTranslationPageState | undefined, event: LiveTranslationCommitEvent, snapshot: LiveTranslationPageSnapshot): SnapshotDecision;
export declare function applyLiveTranslationSnapshot(state: LiveTranslationState, event: LiveTranslationCommitEvent, snapshot: LiveTranslationPageSnapshot): LiveTranslationState;
//# sourceMappingURL=live-translation-state.d.ts.map