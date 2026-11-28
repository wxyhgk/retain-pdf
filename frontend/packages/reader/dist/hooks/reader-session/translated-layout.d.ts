import { type RenderLayoutSource } from "../../shared/data/render-layout.js";
export type TranslatedLayout = {
    source: RenderLayoutSource;
    fontFamily: string;
};
/** 清单加字体最多等这么久，过了照旧下载译文 PDF。 */
export declare const TRANSLATED_LAYOUT_WAIT_MS = 3000;
/** 版面要带这几项，译文栏才能不要译文 PDF。 */
export declare const TRANSLATED_LAYOUT_FEATURES: readonly ["erase", "tables"];
export declare function translatedPdfForced(search?: string): boolean;
/** 版面完整（不用底图、表格也在）才能替掉译文 PDF。 */
export declare function layoutReplacesTranslatedPdf(source: RenderLayoutSource | null): source is RenderLayoutSource;
/** 要清单、装字体；能替掉译文 PDF 就回版面，不然（或超时、出错）回 null。不抛错。 */
export declare function probeTranslatedLayout(jobId: string, { signal, waitMs }?: {
    signal?: AbortSignal;
    waitMs?: number;
}): Promise<TranslatedLayout | null>;
//# sourceMappingURL=translated-layout.d.ts.map