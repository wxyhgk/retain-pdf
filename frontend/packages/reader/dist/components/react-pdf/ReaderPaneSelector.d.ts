import { type ReactElement } from "react";
export type ReaderPaneContent = "source" | "translated" | "markdown" | "ai";
export type ReaderPaneSide = "left" | "right";
export type ReaderPaneSelectorProps = {
    side: ReaderPaneSide;
    value: ReaderPaneContent;
    options: readonly ReaderPaneContent[];
    onChange: (value: ReaderPaneContent) => void;
};
export declare function ReaderPaneSelector({ side, value, options, onChange, }: ReaderPaneSelectorProps): ReactElement;
//# sourceMappingURL=ReaderPaneSelector.d.ts.map