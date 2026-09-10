import { type ReaderSelection } from "../../shared/data/reader-regions.js";
export type ReaderSelectionToolbarProps = {
    selection: ReaderSelection | null;
    onDismiss: () => void;
    onAskAi?: (selection: ReaderSelection) => void;
};
export declare function copyReaderSelectionText(value: string): Promise<void>;
export declare function ReaderSelectionToolbar({ selection, onDismiss, onAskAi, }: ReaderSelectionToolbarProps): import("react").JSX.Element;
//# sourceMappingURL=ReaderSelectionToolbar.d.ts.map