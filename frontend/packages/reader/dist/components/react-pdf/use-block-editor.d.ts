import type { ReaderTranslationEditPort } from "../../contracts/session.js";
import { type RevisionEntry } from "../../shared/data/block-edit.js";
export type BlockEditorStatus = {
    tone: "pending" | "ok" | "error";
    message: string;
} | null;
type Loaded = {
    readerItemId: string;
    itemId: string;
    source: string;
    current: string;
};
export declare function useBlockEditor({ port, jobId, readerItemId, onSaved, }: {
    port: ReaderTranslationEditPort | null;
    /** 持有译文的任务；空串 = 还没问到，先不读。 */
    jobId: string;
    readerItemId: string;
    onSaved: (readerItemId: string, text: string) => void;
}): {
    loading: boolean;
    loaded: Loaded;
    history: RevisionEntry[];
    draft: string;
    setDraft: (value: string) => void;
    reason: string;
    setReason: import("react").Dispatch<import("react").SetStateAction<string>>;
    saving: boolean;
    status: {
        tone: "pending" | "ok" | "error";
        message: string;
    };
    issues: string[];
    save: (text?: string, why?: string) => Promise<boolean>;
    resetDraft: () => void;
};
export {};
//# sourceMappingURL=use-block-editor.d.ts.map