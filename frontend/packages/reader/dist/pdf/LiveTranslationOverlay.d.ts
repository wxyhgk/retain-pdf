import type { ReaderLiveTranslationLayoutPage as LiveTranslationLayoutPage, ReaderLiveTranslationTypography as LiveTranslationTypography } from "../contracts/live-translation.js";
import type { LiveTranslationPageState } from "../shared/data/live-translation-state.js";
import { type ReaderRegionRect } from "../shared/data/reader-regions.js";
export type ProjectedLiveTranslationItem = {
    itemId: string;
    translatedText: string;
    status: string;
    kind: string;
    sourceText: string;
    typography?: LiveTranslationTypography;
    rect: ReaderRegionRect;
    changedAtSeq: number;
    changedNow: boolean;
};
export declare function projectLiveTranslationItems(layoutPage: LiveTranslationLayoutPage | undefined, pageState: LiveTranslationPageState | undefined, renderedWidth: number, renderedHeight: number): ProjectedLiveTranslationItem[];
type LiveTranslationOverlayProps = {
    layoutPage?: LiveTranslationLayoutPage;
    pageState?: LiveTranslationPageState;
    width: number;
    height: number;
};
type LiveTranslationTextStyle = {
    fontFamily: string;
    fontSizePx: number;
    minFontSizePx: number;
    maxFontSizePx: number;
    lineHeight: number;
    fontWeight: string | number;
    textAlign: "left" | "center" | "right" | "justify";
    padding: [number, number, number, number];
    exact: boolean;
};
export declare function prepareLiveTranslationMathHtml(text: string): {
    fallbackHtml: string;
    richHtml: Promise<string>;
    hasMath: boolean;
};
/** Translate Typst point/em values into the current PDF viewport. */
export declare function resolveLiveTranslationTextStyle(item: Pick<ProjectedLiveTranslationItem, "kind" | "rect" | "sourceText" | "typography">, pageScale: number): LiveTranslationTextStyle;
type LiveTranslationTextItemProps = {
    item: ProjectedLiveTranslationItem;
    pageScale: number;
};
type LiveTranslationFitMeasure = (fontSize: number) => {
    width: number;
    height: number;
};
type LiveTranslationFitInput = {
    minFontSizePx: number;
    maxFontSizePx: number;
    requestedFontSizePx: number;
    exact: boolean;
};
/**
 * Binary-search the largest font size whose measured content still fits the
 * available box. This is the exact original search (same brackets, iteration
 * counts and rounding), with two output-preserving reductions in layout reads:
 * repeated probes of the same size are answered from a per-fit memo, and a
 * collapsed bracket stops early instead of re-probing the same endpoint.
 */
export declare function computeLiveTranslationFit(measure: LiveTranslationFitMeasure, availableWidth: number, availableHeight: number, input: LiveTranslationFitInput): number;
export declare function clearLiveTranslationFitCache(): void;
export declare function LiveTranslationTextItem({ item, pageScale }: LiveTranslationTextItemProps): import("react").JSX.Element;
declare function LiveTranslationOverlayInner({ layoutPage, pageState, width, height, }: LiveTranslationOverlayProps): import("react").JSX.Element;
export declare const LiveTranslationOverlay: import("react").MemoExoticComponent<typeof LiveTranslationOverlayInner>;
export {};
//# sourceMappingURL=LiveTranslationOverlay.d.ts.map