export type LiveTranslationLayoutBlock = {
    item_id: string;
    bbox: [number, number, number, number];
    source_text: string;
    kind: string;
    /**
     * Optional renderer-authored typography. The live overlay accepts these
     * values when the API publishes the Typst layout plan, while remaining
     * compatible with older servers that only expose geometry.
     */
    typography?: LiveTranslationTypography;
};
export type LiveTranslationTypography = {
    font_family?: string;
    font_size_pt?: number;
    leading_em?: number;
    font_weight?: string | number;
    text_align?: "left" | "center" | "right" | "justify";
    padding_top_pt?: number;
    padding_right_pt?: number;
    padding_bottom_pt?: number;
    padding_left_pt?: number;
    fit_min_font_size_pt?: number;
    fit_max_font_size_pt?: number;
};
export type LiveTranslationLayoutPage = {
    page_idx: number;
    width: number;
    height: number;
    blocks: LiveTranslationLayoutBlock[];
};
export type LiveTranslationLayout = {
    pages: LiveTranslationLayoutPage[];
};
export type LiveTranslationItem = {
    item_id: string;
    translated_text: string;
    status: string;
};
export type LiveTranslationPageSnapshot = {
    attempt: number;
    generation: number;
    page_idx: number;
    page_hash: string;
    items: LiveTranslationItem[];
};
export type LiveTranslationCommitEvent = {
    event: "translation_units_committed";
    seq: number;
    attempt: number;
    generation: number;
    page_idx: number;
    page_hash: string;
    changed_item_ids: string[];
};
export type LiveTranslationRequestOptions = {
    apiPrefix?: string;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
};
export declare class LiveTranslationApiError extends Error {
    status: number;
    code: string;
    constructor(message: string, status: number, code?: string);
}
export declare function fetchLiveTranslationLayout(jobId: string, options?: LiveTranslationRequestOptions): Promise<LiveTranslationLayout>;
export declare function fetchLiveTranslationPage(jobId: string, pageIdx: number, options?: LiveTranslationRequestOptions): Promise<LiveTranslationPageSnapshot>;
export type StreamLiveTranslationOptions = LiveTranslationRequestOptions & {
    afterSeq?: number;
    onEvent: (event: LiveTranslationCommitEvent) => void | Promise<void>;
};
/** Authenticated fetch-based SSE reader. Resolves only when the stream closes. */
export declare function streamLiveTranslationEvents(jobId: string, options: StreamLiveTranslationOptions): Promise<void>;
