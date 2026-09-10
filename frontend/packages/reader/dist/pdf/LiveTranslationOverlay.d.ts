import type { LiveTranslationLayoutPage, LiveTranslationTypography } from "@retainpdf/api/live-translation";
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
export type LiveTranslationOverlayProps = {
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
declare function LiveTranslationOverlayInner({ layoutPage, pageState, width, height, }: LiveTranslationOverlayProps): import("react").JSX.Element;
export declare const LiveTranslationOverlay: import("react").MemoExoticComponent<typeof LiveTranslationOverlayInner>;
export {};
//# sourceMappingURL=LiveTranslationOverlay.d.ts.map