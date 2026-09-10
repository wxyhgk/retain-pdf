import type { ReaderNote } from "../../annotations/types.js";
export type ReaderNotesPanelProps = {
    open: boolean;
    groups: Array<{
        page: number;
        items: ReaderNote[];
    }>;
    count: number;
    onClose: () => void;
    onJump: (note: ReaderNote) => void;
    onUpdateNote: (id: string, note: string) => void;
    onRemove: (id: string) => void;
    onExport: () => Promise<boolean>;
};
export declare function ReaderNotesPanel({ open, groups, count, onClose, onJump, onUpdateNote, onRemove, onExport, }: ReaderNotesPanelProps): import("react").JSX.Element;
//# sourceMappingURL=ReaderNotesPanel.d.ts.map