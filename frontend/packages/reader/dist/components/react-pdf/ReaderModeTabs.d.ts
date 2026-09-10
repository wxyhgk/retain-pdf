import type { ReactElement } from "react";
import type { ReaderMode } from "../../hooks/use-reader-session.js";
export type ReaderModeTabsProps = {
    mode: ReaderMode;
    sourceOnly: boolean;
    onModeChange: (mode: ReaderMode) => void;
    placement?: "top" | "context";
    splitView?: boolean;
};
export declare function ReaderModeTabs({ mode, sourceOnly, onModeChange, placement, splitView, }: ReaderModeTabsProps): ReactElement;
//# sourceMappingURL=ReaderModeTabs.d.ts.map