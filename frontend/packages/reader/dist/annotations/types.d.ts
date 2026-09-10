export type ReaderNotePane = "source" | "translated";
export type ReaderNote = {
    id: string;
    /** 1-based 页码 */
    page: number;
    pane: ReaderNotePane;
    quote: string;
    note: string;
    createdAt: string;
};
export type ReaderNotesDocKey = {
    jobId?: string;
    documentId?: string;
};
export declare function notesStorageKey(doc: ReaderNotesDocKey): string;
export declare function createNoteId(): string;
export declare function sortNotes(list: ReaderNote[]): ReaderNote[];
export declare function groupNotesByPage(list: ReaderNote[]): Array<{
    page: number;
    items: ReaderNote[];
}>;
export declare function buildNotesMarkdown(title: string, list: ReaderNote[]): string;
//# sourceMappingURL=types.d.ts.map