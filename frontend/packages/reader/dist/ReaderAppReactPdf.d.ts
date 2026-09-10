import type { ReaderAssistantPanel } from "./components/react-pdf/index.js";
import { loadReaderViewState } from "./shared/state/reader-view-state.js";
export declare function resolveReaderAiLayout(_mode: string): "workspace";
export declare function resolveVisiblePdfMode(mode: "source" | "compare" | "translated", assistantPanel: ReaderAssistantPanel | null): "compare" | "source" | "translated";
export declare function resolveInitialAssistantPanel(mode: "source" | "compare" | "translated", saved: ReturnType<typeof loadReaderViewState>): ReaderAssistantPanel | null;
export declare function ReaderAppReactPdf(): import("react").JSX.Element;
//# sourceMappingURL=ReaderAppReactPdf.d.ts.map