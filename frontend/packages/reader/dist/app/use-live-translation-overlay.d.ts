import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import { type ReaderPaneComposition } from "./pane-composition.js";
/** 叠不叠实时译文 + 由它派生的可见台面。三个 effect 的先后有讲究（复位在前、自动打开在后），整段原样搬来。 */
export declare function useLiveTranslationOverlay(c: ReaderReactController, assistantOpen: boolean): {
    liveTranslationVisible: boolean;
    setLiveTranslationVisible: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    paneComposition: ReaderPaneComposition;
    liveToggles: import("../shared/data/live-translation-state.js").LiveTranslationToggles;
    sourceViewOnly: boolean;
    visiblePdfMode: "compare" | "source" | "translated";
};
type Overlay = Pick<ReturnType<typeof useLiveTranslationOverlay>, "liveTranslationVisible" | "setLiveTranslationVisible" | "liveToggles" | "sourceViewOnly"> & {
    visiblePdfMode: ReaderPaneComposition["visibleMode"];
};
/** 顶栏 pill 的「跳到最新一页」、「翻译完成 · 看对照」提示、源栏的「译文」开关。 */
export declare function useLiveTranslationControls(c: ReaderReactController, { liveTranslationVisible, setLiveTranslationVisible, liveToggles, sourceViewOnly, visiblePdfMode }: Overlay): {
    latestLivePage: number;
    jumpToLatestLivePage: () => void;
    offerCompletion: boolean;
    setCompletionDismissedKey: import("react").Dispatch<import("react").SetStateAction<string>>;
    sourcePaneAction: import("react").JSX.Element;
};
export {};
//# sourceMappingURL=use-live-translation-overlay.d.ts.map