import type { ReaderTextHoverTarget } from "./ReaderTextHoverLayer.js";
declare function EditedTranslationOverlayInner({ targets, edits, width, }: {
    targets: readonly ReaderTextHoverTarget[];
    edits: ReadonlyMap<string, string>;
    /** 这一页画出来的宽度（px），和 PDF 的页宽一起算缩放。 */
    width: number;
}): import("react").JSX.Element;
export declare const EditedTranslationOverlay: import("react").MemoExoticComponent<typeof EditedTranslationOverlayInner>;
export {};
//# sourceMappingURL=EditedTranslationOverlay.d.ts.map