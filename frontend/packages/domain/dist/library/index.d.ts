/**
 * Library domain pure helpers — extractable from
 * frontend/web/src/pages/home/features/library/domain/controller.ts
 * and frontend/web-react/src/features/library/model/library-domain.ts
 *
 * Framework-agnostic, no React/DOM/fetch.
 * This package entry proves the shared logic can live in @retainpdf/domain.
 * web-react currently vendors the same file under model/library-domain.ts;
 * future refactor can alias "@retainpdf/domain/library" to this.
 */
export type TranslateDocumentPayload = {
    ocr?: {
        page_ranges?: string;
        [key: string]: unknown;
    };
    translation?: {
        start_page?: number;
        end_page?: number;
        [key: string]: unknown;
    };
    [key: string]: unknown;
};
type ErrorLike = {
    message?: string;
    status?: number;
} | string | null | undefined;
export declare function friendlyTranslateError(error: ErrorLike): string;
export declare function friendlyDocumentDeleteError(error: ErrorLike): string;
export declare function assembleTranslatePayload(overrides?: TranslateDocumentPayload, buildTranslateConfig?: (pageRanges?: string) => TranslateDocumentPayload | Record<string, unknown>): TranslateDocumentPayload;
export type LibraryCardLike = {
    status?: string | null;
    job_id?: string | null;
    active_job_id?: string | null;
    library_only?: boolean;
    prefer_translate_tab?: boolean;
    [key: string]: unknown;
};
export declare function shouldPreferTranslateTab(item?: LibraryCardLike | null): boolean;
export {};
